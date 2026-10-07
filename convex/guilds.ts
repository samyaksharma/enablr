import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query, QueryCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./users";
import {
  activeMembers,
  displayName,
  fail,
  getActiveGuild,
  getMembership,
  getSystemRole,
  grantBadge,
  membersWithPermission,
  notify,
  outranks,
  requireMember,
  requirePermission,
  validateUpload,
} from "./lib/access";
import { LIMITS, PERMISSIONS, SYSTEM_ROLES, roleHasPermission } from "./permissions";

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < LIMITS.nameMin || trimmed.length > LIMITS.nameMax) {
    fail(`Guild names must be ${LIMITS.nameMin}–${LIMITS.nameMax} characters.`);
  }
  return trimmed;
}

function cleanDescription(description: string): string {
  const trimmed = description.trim();
  if (trimmed.length === 0) fail("Add a description so people know what the guild is about.");
  if (trimmed.length > LIMITS.descriptionMax) {
    fail(`Descriptions can be up to ${LIMITS.descriptionMax} characters.`);
  }
  return trimmed;
}

async function assertNameFree(ctx: QueryCtx, nameLower: string, except?: Id<"guilds">) {
  const taken = await ctx.db
    .query("guilds")
    .withIndex("by_nameLower", (q) => q.eq("nameLower", nameLower))
    .collect();
  if (taken.some((g) => g._id !== except && g.deletedAt === undefined)) {
    fail("A guild with that name already exists.");
  }
}

async function activeMembershipCount(ctx: QueryCtx, userId: Id<"users">): Promise<number> {
  const rows = await ctx.db
    .query("guildMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let count = 0;
  for (const row of rows) {
    if (row.leftAt !== undefined) continue;
    const guild = await ctx.db.get(row.guildId);
    if (guild && guild.deletedAt === undefined) count++;
  }
  return count;
}

async function publicGuild(ctx: QueryCtx, guild: Doc<"guilds">) {
  return {
    _id: guild._id,
    name: guild.name,
    description: guild.description,
    emblemUrl: guild.emblemId ? await ctx.storage.getUrl(guild.emblemId) : null,
    memberCount: guild.memberCount,
  };
}

// Short-lived URL for uploading a guild emblem or role icon.
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    emblemId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = cleanName(args.name);
    const description = cleanDescription(args.description);
    await assertNameFree(ctx, name.toLowerCase());

    const owned = await ctx.db
      .query("guilds")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    if (owned.filter((g) => g.deletedAt === undefined).length >= LIMITS.guildsOwned) {
      fail(`You can own up to ${LIMITS.guildsOwned} guilds.`);
    }
    if ((await activeMembershipCount(ctx, userId)) >= LIMITS.guildsJoined) {
      fail(`You can be in up to ${LIMITS.guildsJoined} guilds.`);
    }
    if (args.emblemId) await validateUpload(ctx, args.emblemId, "image", LIMITS.imageBytes);

    const now = Date.now();
    const guildId = await ctx.db.insert("guilds", {
      name,
      nameLower: name.toLowerCase(),
      description,
      emblemId: args.emblemId,
      ownerId: userId,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    });

    let ownerRoleId: Id<"guildRoles"> | null = null;
    for (const role of SYSTEM_ROLES) {
      const roleId = await ctx.db.insert("guildRoles", {
        guildId,
        name: role.name,
        color: role.color,
        position: role.position,
        permissions: role.permissions,
        system: role.system,
      });
      if (role.system === "owner") ownerRoleId = roleId;
    }

    await ctx.db.insert("guildMembers", {
      guildId,
      userId,
      roleId: ownerRoleId!,
      xp: 0,
      level: 1,
      joinedAt: now,
    });
    await grantBadge(ctx, userId, "founder");
    return guildId;
  },
});

export const update = mutation({
  args: {
    guildId: v.id("guilds"),
    name: v.string(),
    description: v.string(),
    // undefined keeps the current emblem
    emblemId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { guild } = await requirePermission(ctx, args.guildId, userId, "edit_guild");
    const name = cleanName(args.name);
    const description = cleanDescription(args.description);
    await assertNameFree(ctx, name.toLowerCase(), guild._id);

    if (args.emblemId) {
      await validateUpload(ctx, args.emblemId, "image", LIMITS.imageBytes);
      if (guild.emblemId && guild.emblemId !== args.emblemId) {
        await ctx.storage.delete(guild.emblemId);
      }
    }
    await ctx.db.patch(guild._id, {
      name,
      nameLower: name.toLowerCase(),
      description,
      ...(args.emblemId ? { emblemId: args.emblemId } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const search = query({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const text = args.text.trim();
    const guilds =
      text.length === 0
        ? await ctx.db.query("guilds").order("desc").take(60)
        : await ctx.db
            .query("guilds")
            .withSearchIndex("search_name", (q) => q.search("name", text))
            .take(60);
    const visible = guilds.filter((g) => g.deletedAt === undefined).slice(0, 30);
    return await Promise.all(visible.map((g) => publicGuild(ctx, g)));
  },
});

// Everything the guild page needs. Non-members get the public page only.
export const overview = query({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const guild = await ctx.db.get(args.guildId);
    if (!guild || guild.deletedAt !== undefined) return null;

    const roles = await ctx.db
      .query("guildRoles")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();
    const roleById = new Map(roles.map((r) => [r._id, r]));
    const members = await activeMembers(ctx, guild._id);

    // Staff = Owner plus holders of the built-in Admin and Mod roles
    const staff = [];
    for (const m of members) {
      const role = roleById.get(m.roleId);
      if (!role || !role.system || role.system === "member") continue;
      staff.push({
        userId: m.userId,
        name: displayName(await ctx.db.get(m.userId)),
        roleName: role.name,
        roleColor: role.color,
        position: role.position,
      });
    }
    staff.sort((a, b) => a.position - b.position);

    const mine = members.find((m) => m.userId === userId);
    const myRole = mine ? roleById.get(mine.roleId) : undefined;

    let membership = null;
    let pendingRequests = 0;
    let pendingReviews = 0;
    if (mine && myRole) {
      membership = {
        roleId: myRole._id,
        roleName: myRole.name,
        roleColor: myRole.color,
        roleIconUrl: myRole.iconId ? await ctx.storage.getUrl(myRole.iconId) : null,
        system: myRole.system ?? null,
        position: myRole.position,
        permissions: PERMISSIONS.filter((p) => roleHasPermission(myRole, p)),
        xp: mine.xp,
        level: mine.level,
        muted: mine.muted ?? false,
      };
      if (roleHasPermission(myRole, "manage_requests")) {
        const pending = await ctx.db
          .query("guildJoinRequests")
          .withIndex("by_guild_status", (q) => q.eq("guildId", guild._id).eq("status", "pending"))
          .collect();
        pendingRequests = pending.length;
      }
      if (roleHasPermission(myRole, "review_submissions")) {
        const pending = await ctx.db
          .query("guildTaskSubmissions")
          .withIndex("by_guild_status", (q) =>
            q.eq("guildId", guild._id).eq("status", "pending_review")
          )
          .collect();
        pendingReviews = pending.filter((s) => s.userId !== userId).length;
      }
    }

    let request = null;
    if (!membership) {
      const mineRequests = await ctx.db
        .query("guildJoinRequests")
        .withIndex("by_guild_user", (q) => q.eq("guildId", guild._id).eq("userId", userId))
        .collect();
      const latest = mineRequests.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (latest?.status === "pending") {
        request = { status: "pending" as const, requestId: latest._id, canRequestAt: 0 };
      } else if (latest?.status === "denied") {
        request = {
          status: "denied" as const,
          requestId: latest._id,
          canRequestAt: (latest.decidedAt ?? latest.createdAt) + LIMITS.rejoinAfterDenyMs,
        };
      }
    }

    return {
      ...(await publicGuild(ctx, guild)),
      staff,
      membership,
      request,
      pendingRequests,
      pendingReviews,
    };
  },
});

export const myGuilds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { guilds: [], pending: [], deleted: [] };

    const rows = await ctx.db
      .query("guildMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const guilds = [];
    const deleted = [];
    for (const row of rows) {
      if (row.leftAt !== undefined) continue;
      const guild = await ctx.db.get(row.guildId);
      const role = await ctx.db.get(row.roleId);
      if (!guild || !role) continue;
      if (guild.deletedAt !== undefined) {
        // Only the owner can restore a guild during its grace period
        if (guild.ownerId === userId) {
          deleted.push({
            _id: guild._id,
            name: guild.name,
            purgeAt: guild.deletedAt + LIMITS.deleteGraceMs,
          });
        }
        continue;
      }
      guilds.push({
        ...(await publicGuild(ctx, guild)),
        roleName: role.name,
        roleColor: role.color,
        roleIconUrl: role.iconId ? await ctx.storage.getUrl(role.iconId) : null,
        xp: row.xp,
        level: row.level,
      });
    }
    guilds.sort((a, b) => a.name.localeCompare(b.name));

    const requests = await ctx.db
      .query("guildJoinRequests")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "pending"))
      .collect();
    const pending = [];
    for (const request of requests) {
      const guild = await ctx.db.get(request.guildId);
      if (guild && guild.deletedAt === undefined) pending.push(await publicGuild(ctx, guild));
    }

    return { guilds, pending, deleted };
  },
});

// Members see the full list. Everyone else sees only the staff.
export const members = query({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { scope: "staff" as const, members: [] };
    const guild = await ctx.db.get(args.guildId);
    if (!guild || guild.deletedAt !== undefined) return { scope: "staff" as const, members: [] };

    const roles = await ctx.db
      .query("guildRoles")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .collect();
    const roleById = new Map(roles.map((r) => [r._id, r]));
    const all = await activeMembers(ctx, guild._id);
    const isMember = all.some((m) => m.userId === userId);

    const list = [];
    for (const m of all) {
      const role = roleById.get(m.roleId);
      if (!role) continue;
      const isStaff = !!role.system && role.system !== "member";
      if (!isMember && !isStaff) continue;
      list.push({
        userId: m.userId,
        name: displayName(await ctx.db.get(m.userId)),
        isMe: m.userId === userId,
        roleId: role._id,
        roleName: role.name,
        roleColor: role.color,
        roleIconUrl: role.iconId ? await ctx.storage.getUrl(role.iconId) : null,
        position: role.position,
        // Level and join date are for members' eyes only
        level: isMember ? m.level : null,
        xp: isMember ? m.xp : null,
        joinedAt: isMember ? m.joinedAt : null,
      });
    }
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    return { scope: isMember ? ("full" as const) : ("staff" as const), members: list };
  },
});

export const requestJoin = mutation({
  args: { guildId: v.id("guilds"), message: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const guild = await getActiveGuild(ctx, args.guildId);
    if (await getMembership(ctx, guild._id, userId)) fail("You're already in this guild.");

    const message = args.message.trim();
    if (message.length > LIMITS.joinMessageMax) {
      fail(`Messages can be up to ${LIMITS.joinMessageMax} characters.`);
    }

    const previous = await ctx.db
      .query("guildJoinRequests")
      .withIndex("by_guild_user", (q) => q.eq("guildId", guild._id).eq("userId", userId))
      .collect();
    if (previous.some((r) => r.status === "pending")) {
      fail("You already have a request waiting for this guild.");
    }
    const lastDenied = previous
      .filter((r) => r.status === "denied")
      .sort((a, b) => (b.decidedAt ?? 0) - (a.decidedAt ?? 0))[0];
    if (lastDenied && Date.now() < (lastDenied.decidedAt ?? 0) + LIMITS.rejoinAfterDenyMs) {
      fail("Your last request was declined. You can ask again a week after that.");
    }
    if ((await activeMembershipCount(ctx, userId)) >= LIMITS.guildsJoined) {
      fail(`You can be in up to ${LIMITS.guildsJoined} guilds. Leave one to join another.`);
    }

    await ctx.db.insert("guildJoinRequests", {
      guildId: guild._id,
      userId,
      message,
      status: "pending",
      createdAt: Date.now(),
    });

    const requester = displayName(await ctx.db.get(userId));
    await notify(
      ctx,
      await membersWithPermission(ctx, guild._id, "manage_requests"),
      guild.name,
      `${requester} wants to join.`,
      { guildId: guild._id }
    );
  },
});

export const cancelRequest = mutation({
  args: { requestId: v.id("guildJoinRequests") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request || request.userId !== userId || request.status !== "pending") return;
    await ctx.db.patch(request._id, { status: "cancelled", decidedAt: Date.now() });
  },
});

export const requests = query({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const membership = await getMembership(ctx, args.guildId, userId);
    if (!membership || !roleHasPermission(membership.role, "manage_requests")) return [];

    const pending = await ctx.db
      .query("guildJoinRequests")
      .withIndex("by_guild_status", (q) => q.eq("guildId", args.guildId).eq("status", "pending"))
      .collect();
    const list = [];
    for (const request of pending.sort((a, b) => a.createdAt - b.createdAt)) {
      list.push({
        _id: request._id,
        name: displayName(await ctx.db.get(request.userId)),
        message: request.message,
        createdAt: request.createdAt,
      });
    }
    return list;
  },
});

export const decideRequest = mutation({
  args: { requestId: v.id("guildJoinRequests"), approve: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (!request) fail("That request no longer exists.");
    const { guild } = await requirePermission(ctx, request.guildId, userId, "manage_requests");
    if (request.status !== "pending") fail("That request has already been handled.");

    const now = Date.now();
    if (!args.approve) {
      await ctx.db.patch(request._id, { status: "denied", decidedBy: userId, decidedAt: now });
      await notify(ctx, [request.userId], guild.name, "Your request to join was declined.", {
        guildId: guild._id,
      });
      return;
    }

    if ((await activeMembershipCount(ctx, request.userId)) >= LIMITS.guildsJoined) {
      fail("This adventurer is already in the maximum number of guilds.");
    }

    const memberRole = await getSystemRole(ctx, guild._id, "member");
    const previous = await ctx.db
      .query("guildMembers")
      .withIndex("by_guild_user", (q) => q.eq("guildId", guild._id).eq("userId", request.userId))
      .first();
    if (previous) {
      // Rejoining restores the XP that was frozen when they left
      await ctx.db.patch(previous._id, {
        leftAt: undefined,
        roleId: memberRole._id,
        joinedAt: now,
        muted: false,
      });
    } else {
      await ctx.db.insert("guildMembers", {
        guildId: guild._id,
        userId: request.userId,
        roleId: memberRole._id,
        xp: 0,
        level: 1,
        joinedAt: now,
      });
    }
    await ctx.db.patch(guild._id, { memberCount: guild.memberCount + 1 });
    await ctx.db.patch(request._id, { status: "approved", decidedBy: userId, decidedAt: now });
    await grantBadge(ctx, request.userId, "sworn_in");
    await notify(ctx, [request.userId], guild.name, "You're in! Your request was approved.", {
      guildId: guild._id,
    });
  },
});

async function removeFromGuild(
  ctx: Parameters<typeof notify>[0],
  guild: Doc<"guilds">,
  member: Doc<"guildMembers">
) {
  await ctx.db.patch(member._id, { leftAt: Date.now() });
  await ctx.db.patch(guild._id, { memberCount: Math.max(0, guild.memberCount - 1) });
}

export const leave = mutation({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { guild, member, role } = await requireMember(ctx, args.guildId, userId);
    if (role.system === "owner") {
      fail("Transfer ownership to another member before leaving.");
    }
    await removeFromGuild(ctx, guild, member);
  },
});

export const removeMember = mutation({
  args: { guildId: v.id("guilds"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const actorId = await requireUserId(ctx);
    const actor = await requirePermission(ctx, args.guildId, actorId, "remove_members");
    const target = await getMembership(ctx, args.guildId, args.userId);
    if (!target) fail("That adventurer is no longer in the guild.");
    if (!outranks(actor.role, target.role)) {
      fail("You can only remove members ranked below you.");
    }
    await removeFromGuild(ctx, actor.guild, target.member);
    await notify(ctx, [args.userId], actor.guild.name, "You were removed from the guild.");
  },
});

export const transferOwnership = mutation({
  args: { guildId: v.id("guilds"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const actorId = await requireUserId(ctx);
    const actor = await requireMember(ctx, args.guildId, actorId);
    if (actor.role.system !== "owner") fail("Only the Owner can transfer ownership.");
    if (args.userId === actorId) return;
    const target = await getMembership(ctx, args.guildId, args.userId);
    if (!target) fail("That adventurer is no longer in the guild.");

    const owned = await ctx.db
      .query("guilds")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
      .collect();
    if (owned.filter((g) => g.deletedAt === undefined).length >= LIMITS.guildsOwned) {
      fail(`They already own ${LIMITS.guildsOwned} guilds.`);
    }

    const adminRole = await getSystemRole(ctx, args.guildId, "admin");
    await ctx.db.patch(target.member._id, { roleId: actor.role._id });
    await ctx.db.patch(actor.member._id, { roleId: adminRole._id });
    await ctx.db.patch(actor.guild._id, { ownerId: args.userId, updatedAt: Date.now() });
    await notify(ctx, [args.userId], actor.guild.name, "You are now the Owner of this guild.", {
      guildId: actor.guild._id,
    });
  },
});

export const deleteGuild = mutation({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { guild, role } = await requireMember(ctx, args.guildId, userId);
    if (role.system !== "owner") fail("Only the Owner can delete the guild.");
    await ctx.db.patch(guild._id, { deletedAt: Date.now() });
  },
});

export const restoreGuild = mutation({
  args: { guildId: v.id("guilds") },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const guild = await ctx.db.get(args.guildId);
    if (!guild || guild.ownerId !== userId) fail("Only the Owner can restore the guild.");
    if (guild.deletedAt === undefined) return;
    await assertNameFree(ctx, guild.nameLower, guild._id);
    await ctx.db.patch(guild._id, { deletedAt: undefined });
  },
});

export const setMuted = mutation({
  args: { guildId: v.id("guilds"), muted: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { member } = await requireMember(ctx, args.guildId, userId);
    await ctx.db.patch(member._id, { muted: args.muted });
  },
});

export const report = mutation({
  args: {
    guildId: v.id("guilds"),
    submissionId: v.optional(v.id("guildTaskSubmissions")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await getActiveGuild(ctx, args.guildId);
    const reason = args.reason.trim().slice(0, 500);
    if (reason.length === 0) fail("Tell us what's wrong so we can look into it.");
    if (args.submissionId) {
      // Only people who can watch a proof video can report it
      await requirePermission(ctx, args.guildId, userId, "review_submissions");
    }
    await ctx.db.insert("reports", {
      reporterId: userId,
      guildId: args.guildId,
      submissionId: args.submissionId,
      reason,
      createdAt: Date.now(),
    });
  },
});
