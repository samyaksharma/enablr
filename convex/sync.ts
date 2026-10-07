import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./users";

export const pushHabits = mutation({
  args: {
    habits: v.array(
      v.object({
        externalId: v.string(),
        name: v.string(),
        description: v.string(),
        recurrence: v.any(),
        category: v.string(),
        difficulty: v.string(),
        scheduledTime: v.optional(v.string()),
        reminderEnabled: v.optional(v.boolean()),
        archived: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
        clientId: v.string(),
        localVersion: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const serverUpdatedAt = Date.now();
    for (const habit of args.habits) {
      const existing = await ctx.db
        .query("habits")
        .withIndex("by_externalId", (q) => q.eq("externalId", habit.externalId))
        .first();

      if (!existing) {
        await ctx.db.insert("habits", { userId, ...habit, serverUpdatedAt });
        continue;
      }
      if (existing.userId !== userId) {
        throw new Error("Habit belongs to another account");
      }
      // Last write wins, and the server wins ties: a stale push is dropped and
      // the device picks up the newer version on its next pull.
      if (existing.updatedAt >= habit.updatedAt) continue;

      await ctx.db.patch(existing._id, {
        name: habit.name,
        description: habit.description,
        recurrence: habit.recurrence,
        category: habit.category,
        difficulty: habit.difficulty,
        scheduledTime: habit.scheduledTime,
        reminderEnabled: habit.reminderEnabled,
        archived: habit.archived,
        updatedAt: habit.updatedAt,
        clientId: habit.clientId,
        localVersion: habit.localVersion,
        serverUpdatedAt,
      });
    }
  },
});

export const pushCompletions = mutation({
  args: {
    completions: v.array(
      v.object({
        externalId: v.string(),
        habitId: v.string(),
        completedAt: v.string(),
        xpEarned: v.number(),
        clientId: v.string(),
        localVersion: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const serverUpdatedAt = Date.now();
    for (const completion of args.completions) {
      const existing = await ctx.db
        .query("completions")
        .withIndex("by_externalId", (q) => q.eq("externalId", completion.externalId))
        .first();

      if (!existing) {
        await ctx.db.insert("completions", { userId, ...completion, serverUpdatedAt });
      }
    }
  },
});

export const pushBadges = mutation({
  args: {
    badges: v.array(
      v.object({
        externalId: v.string(),
        badgeType: v.string(),
        earnedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const owned = await ctx.db
      .query("badges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const ownedTypes = new Set(owned.map((b) => b.badgeType));
    for (const badge of args.badges) {
      // One badge of each type per account, whichever device earned it first
      if (ownedTypes.has(badge.badgeType)) continue;
      ownedTypes.add(badge.badgeType);
      await ctx.db.insert("badges", { userId, ...badge });
    }
  },
});

export const pushUserProfile = mutation({
  args: {
    name: v.string(),
    characterName: v.string(),
    characterClass: v.string(),
    xp: v.number(),
    level: v.number(),
    utcOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    // XP only ever goes up, so a device with a stale total can't lower it.
    const existing = await ctx.db.get(userId);
    const keepExisting = (existing?.xp ?? 0) > args.xp;
    await ctx.db.patch(userId, {
      name: args.name,
      characterName: args.characterName,
      characterClass: args.characterClass,
      xp: keepExisting ? existing!.xp : args.xp,
      level: keepExisting ? existing!.level : args.level,
      ...(args.utcOffsetMinutes !== undefined ? { utcOffsetMinutes: args.utcOffsetMinutes } : {}),
    });
  },
});

// Pulls are paged by the server's own clock (`serverUpdatedAt`), not by the
// timestamps devices write, so a record made offline days ago is still picked
// up by other devices once it finally reaches the server.
export const pullHabits = query({
  args: {
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    if (args.since === undefined) {
      return await ctx.db
        .query("habits")
        .withIndex("by_userId_serverUpdatedAt", (q) => q.eq("userId", userId))
        .collect();
    }
    return await ctx.db
      .query("habits")
      .withIndex("by_userId_serverUpdatedAt", (q) =>
        q.eq("userId", userId).gt("serverUpdatedAt", args.since!)
      )
      .collect();
  },
});

export const pullCompletions = query({
  args: {
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    if (args.since === undefined) {
      return await ctx.db
        .query("completions")
        .withIndex("by_userId_serverUpdatedAt", (q) => q.eq("userId", userId))
        .collect();
    }
    return await ctx.db
      .query("completions")
      .withIndex("by_userId_serverUpdatedAt", (q) =>
        q.eq("userId", userId).gt("serverUpdatedAt", args.since!)
      )
      .collect();
  },
});

export const pullBadges = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    return await ctx.db
      .query("badges")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

// The server's clock, used as the cursor for the next pull. Requiring a session
// here stops a pull from quietly returning nothing (and moving the cursor on)
// if the device's login hasn't been attached yet.
export const serverTime = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return Date.now();
  },
});
