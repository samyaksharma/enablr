import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./users";
import {
  activeMembers,
  fail,
  getMembership,
  getSystemRole,
  notifyMember,
  outranks,
  requirePermission,
  validateUpload,
} from "./lib/access";
import { LIMITS, PERMISSIONS, Permission, roleHasPermission } from "./permissions";

async function guildRoles(ctx: QueryCtx, guildId: Id<"guilds">) {
  const roles = await ctx.db
    .query("guildRoles")
    .withIndex("by_guild", (q) => q.eq("guildId", guildId))
    .collect();
  return roles.sort((a, b) => a.position - b.position);
}

function cleanRoleName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0 || trimmed.length > LIMITS.roleNameMax) {
    fail(`Role names must be 1–${LIMITS.roleNameMax} characters.`);
  }
  return trimmed;
}

function cleanColor(color: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail("Pick a colour for the role.");
  return color;
}

// Keeps only real permissions, and refuses any the actor doesn't hold themselves
// unless the role already had it.
function cleanPermissions(
  requested: string[],
  actorRole: Doc<"guildRoles">,
  current: string[] = []
): Permission[] {
  const result: Permission[] = [];
  for (const permission of PERMISSIONS) {
    if (!requested.includes(permission)) continue;
    if (!roleHasPermission(actorRole, permission) && !current.includes(permission)) {
      fail("You can't grant a permission you don't have yourself.");
    }
    result.push(permission);
  }
  return result;
}

export const list = query({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const mine = await getMembership(ctx, args.guildId, userId);
    if (!mine) return [];

    const roles = await guildRoles(ctx, args.guildId);
    const members = await activeMembers(ctx, args.guildId);
    const canManage = roleHasPermission(mine.role, "manage_roles");
    const canAssign = roleHasPermission(mine.role, "assign_roles");

    return await Promise.all(
      roles.map(async (role) => {
        const below = outranks(mine.role, role);
        return {
          _id: role._id,
          name: role.name,
          color: role.color,
          iconUrl: role.iconId ? await ctx.storage.getUrl(role.iconId) : null,
          position: role.position,
          permissions: PERMISSIONS.filter((p) => roleHasPermission(role, p)),
          system: role.system ?? null,
          memberCount: members.filter((m) => m.roleId === role._id).length,
          canEdit: canManage && below && role.system !== "owner" && role.system !== "member",
          canDelete: canManage && below && !role.system,
          canAssign: canAssign && below && role.system !== "owner",
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    guildId: v.id("guilds"),
    name: v.string(),
    color: v.string(),
    iconId: v.optional(v.id("_storage")),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const actor = await requirePermission(ctx, args.guildId, userId, "manage_roles");
    const roles = await guildRoles(ctx, args.guildId);
    if (roles.filter((r) => !r.system).length >= LIMITS.customRoles) {
      fail(`A guild can have up to ${LIMITS.customRoles} custom roles.`);
    }
    const name = cleanRoleName(args.name);
    if (roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      fail("This guild already has a role with that name.");
    }
    if (args.iconId) await validateUpload(ctx, args.iconId, "image", LIMITS.imageBytes);

    // New roles start at the bottom, just above Member
    const ranked = roles.filter((r) => r.system !== "member");
    const position = Math.max(...ranked.map((r) => r.position)) + 1;
    return await ctx.db.insert("guildRoles", {
      guildId: args.guildId,
      name,
      color: cleanColor(args.color),
      iconId: args.iconId,
      position,
      permissions: cleanPermissions(args.permissions, actor.role),
    });
  },
});

export const update = mutation({
  args: {
    roleId: v.id("guildRoles"),
    name: v.string(),
    color: v.string(),
    // undefined keeps the current icon
    iconId: v.optional(v.id("_storage")),
    removeIcon: v.optional(v.boolean()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) fail("That role no longer exists.");
    const actor = await requirePermission(ctx, role.guildId, userId, "manage_roles");
    if (role.system === "owner" || role.system === "member") {
      fail("The Owner and Member roles can't be edited.");
    }
    if (!outranks(actor.role, role)) fail("You can only edit roles ranked below your own.");

    const name = cleanRoleName(args.name);
    const roles = await guildRoles(ctx, role.guildId);
    if (roles.some((r) => r._id !== role._id && r.name.toLowerCase() === name.toLowerCase())) {
      fail("This guild already has a role with that name.");
    }

    let iconId = role.iconId;
    if (args.iconId) {
      await validateUpload(ctx, args.iconId, "image", LIMITS.imageBytes);
      iconId = args.iconId;
    } else if (args.removeIcon) {
      iconId = undefined;
    }
    if (role.iconId && role.iconId !== iconId) await ctx.storage.delete(role.iconId);

    await ctx.db.patch(role._id, {
      name,
      color: cleanColor(args.color),
      iconId,
      permissions: cleanPermissions(args.permissions, actor.role, role.permissions),
    });
  },
});

export const remove = mutation({
  args: { roleId: v.id("guildRoles") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) return;
    const actor = await requirePermission(ctx, role.guildId, userId, "manage_roles");
    if (role.system) fail("Built-in roles can't be deleted.");
    if (!outranks(actor.role, role)) fail("You can only delete roles ranked below your own.");

    // Anyone holding the role drops back to Member
    const memberRole = await getSystemRole(ctx, role.guildId, "member");
    const members = await activeMembers(ctx, role.guildId);
    for (const m of members.filter((m) => m.roleId === role._id)) {
      await ctx.db.patch(m._id, { roleId: memberRole._id });
    }
    // Tasks assigned to the role fall back to everyone
    const tasks = await ctx.db
      .query("guildTasks")
      .withIndex("by_guild", (q) => q.eq("guildId", role.guildId))
      .collect();
    for (const task of tasks) {
      if (task.assignment.type === "role" && task.assignment.roleId === role._id) {
        await ctx.db.patch(task._id, { assignment: { type: "everyone" } });
      }
    }
    if (role.iconId) await ctx.storage.delete(role.iconId);
    await ctx.db.delete(role._id);
  },
});

// Swap a role with its neighbour in the role order.
export const move = mutation({
  args: { roleId: v.id("guildRoles"), direction: v.union(v.literal("up"), v.literal("down")) },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const role = await ctx.db.get(args.roleId);
    if (!role) fail("That role no longer exists.");
    const actor = await requirePermission(ctx, role.guildId, userId, "manage_roles");

    const movable = (await guildRoles(ctx, role.guildId)).filter(
      (r) => r.system !== "owner" && r.system !== "member"
    );
    const index = movable.findIndex((r) => r._id === role._id);
    const neighbour = movable[index + (args.direction === "up" ? -1 : 1)];
    if (index < 0 || !neighbour) return;
    if (!outranks(actor.role, role) || !outranks(actor.role, neighbour)) {
      fail("You can only reorder roles ranked below your own.");
    }
    await ctx.db.patch(role._id, { position: neighbour.position });
    await ctx.db.patch(neighbour._id, { position: role.position });
  },
});

export const assign = mutation({
  args: { guildId: v.id("guilds"), userId: v.id("users"), roleId: v.id("guildRoles") },
  handler: async (ctx, args) => {
    const actorId = await requireUserId(ctx);
    const actor = await requirePermission(ctx, args.guildId, actorId, "assign_roles");
    const target = await getMembership(ctx, args.guildId, args.userId);
    if (!target) fail("That adventurer is no longer in the guild.");
    const role = await ctx.db.get(args.roleId);
    if (!role || role.guildId !== args.guildId) fail("That role no longer exists.");
    if (role.system === "owner") fail("Use Transfer Ownership to change the Owner.");
    if (!outranks(actor.role, target.role)) {
      fail("You can only change the role of members ranked below you.");
    }
    if (!outranks(actor.role, role)) {
      fail("You can only assign roles ranked below your own.");
    }
    if (target.member.roleId === role._id) return;

    await ctx.db.patch(target.member._id, { roleId: role._id });
    await notifyMember(
      ctx,
      args.guildId,
      args.userId,
      actor.guild.name,
      `Your role is now ${role.name}.`
    );
  },
});
