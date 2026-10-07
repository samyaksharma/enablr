import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { Permission, roleHasPermission } from "../permissions";

type Ctx = QueryCtx | MutationCtx;

// Errors thrown with fail() carry a message that is safe to show to the user.
export function fail(message: string): never {
  throw new ConvexError(message);
}

export function displayName(user: Doc<"users"> | null): string {
  // `name` defaults to the sign-up email, so it is never shown to other people.
  return user?.characterName?.trim() || "Adventurer";
}

export async function getActiveGuild(ctx: Ctx, guildId: Id<"guilds">): Promise<Doc<"guilds">> {
  const guild = await ctx.db.get(guildId);
  if (!guild || guild.deletedAt !== undefined) fail("This guild no longer exists.");
  return guild;
}

export async function getMembership(
  ctx: Ctx,
  guildId: Id<"guilds">,
  userId: Id<"users">
): Promise<{ member: Doc<"guildMembers">; role: Doc<"guildRoles"> } | null> {
  const member = await ctx.db
    .query("guildMembers")
    .withIndex("by_guild_user", (q) => q.eq("guildId", guildId).eq("userId", userId))
    .first();
  if (!member || member.leftAt !== undefined) return null;
  const role = await ctx.db.get(member.roleId);
  if (!role) return null;
  return { member, role };
}

export async function requireMember(ctx: Ctx, guildId: Id<"guilds">, userId: Id<"users">) {
  const guild = await getActiveGuild(ctx, guildId);
  const membership = await getMembership(ctx, guildId, userId);
  if (!membership) fail("You are not a member of this guild.");
  return { guild, ...membership };
}

// Every guild write goes through this: it loads the caller's role from the
// session-derived user ID and checks the permission before anything happens.
export async function requirePermission(
  ctx: Ctx,
  guildId: Id<"guilds">,
  userId: Id<"users">,
  permission: Permission
) {
  const access = await requireMember(ctx, guildId, userId);
  if (!roleHasPermission(access.role, permission)) {
    fail("Your role doesn't allow that.");
  }
  return access;
}

// Role order is a hard limit: you can only act on roles and members below you.
export function outranks(actor: Doc<"guildRoles">, target: Doc<"guildRoles">): boolean {
  return actor.position < target.position;
}

export async function getSystemRole(
  ctx: Ctx,
  guildId: Id<"guilds">,
  system: "owner" | "admin" | "mod" | "member"
): Promise<Doc<"guildRoles">> {
  const roles = await ctx.db
    .query("guildRoles")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  const role = roles.find((r) => r.system === system);
  if (!role) fail("This guild is missing a built-in role.");
  return role;
}

export async function activeMembers(ctx: Ctx, guildId: Id<"guilds">) {
  const members = await ctx.db
    .query("guildMembers")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  return members.filter((m) => m.leftAt === undefined);
}

// User IDs of members whose role grants a permission, skipping anyone who has
// muted the guild. Used to address notifications.
export async function membersWithPermission(
  ctx: Ctx,
  guildId: Id<"guilds">,
  permission: Permission,
  exclude?: Id<"users">
): Promise<Id<"users">[]> {
  const roles = await ctx.db
    .query("guildRoles")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  const allowed = new Set(roles.filter((r) => roleHasPermission(r, permission)).map((r) => r._id));
  const members = await activeMembers(ctx, guildId);
  return members
    .filter((m) => allowed.has(m.roleId) && !m.muted && m.userId !== exclude)
    .map((m) => m.userId);
}

export async function notify(
  ctx: MutationCtx,
  userIds: Id<"users">[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  if (userIds.length === 0) return;
  await ctx.scheduler.runAfter(0, internal.push.send, { userIds, title, body, data });
}

// Notify one member about something in a guild, unless they muted it.
export async function notifyMember(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
  userId: Id<"users">,
  title: string,
  body: string
): Promise<void> {
  const membership = await getMembership(ctx, guildId, userId);
  if (membership?.member.muted) return;
  await notify(ctx, [userId], title, body, { guildId });
}

export async function grantBadge(
  ctx: MutationCtx,
  userId: Id<"users">,
  badgeType: string
): Promise<void> {
  const owned = await ctx.db
    .query("badges")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (owned.some((b) => b.badgeType === badgeType)) return;
  await ctx.db.insert("badges", {
    userId,
    externalId: `${userId}:${badgeType}`,
    badgeType,
    earnedAt: new Date().toISOString(),
  });
}

// Checks an uploaded file is the expected kind and size, deleting it if not.
export async function validateUpload(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  kind: "image" | "video",
  maxBytes: number
): Promise<void> {
  const file = await ctx.db.system.get(storageId);
  if (!file) fail("The upload could not be found. Please try again.");
  const okType = file.contentType?.startsWith(`${kind}/`) ?? false;
  if (!okType || file.size > maxBytes) {
    await ctx.storage.delete(storageId);
    const mb = Math.round(maxBytes / (1024 * 1024));
    fail(
      okType
        ? `That ${kind} is too large. The limit is ${mb} MB.`
        : `That file isn't ${kind === "image" ? "an image" : "a video"}.`
    );
  }
}
