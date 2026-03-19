import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const pushHabits = mutation({
  args: {
    userId: v.string(),
    habits: v.array(
      v.object({
        externalId: v.string(),
        name: v.string(),
        description: v.string(),
        recurrence: v.any(),
        category: v.string(),
        difficulty: v.string(),
        scheduledTime: v.optional(v.string()),
        archived: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
        clientId: v.string(),
        localVersion: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const habit of args.habits) {
      const existing = await ctx.db
        .query("habits")
        .withIndex("by_externalId", (q) => q.eq("externalId", habit.externalId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          name: habit.name,
          description: habit.description,
          recurrence: habit.recurrence,
          category: habit.category,
          difficulty: habit.difficulty,
          scheduledTime: habit.scheduledTime,
          archived: habit.archived,
          updatedAt: habit.updatedAt,
          clientId: habit.clientId,
          localVersion: habit.localVersion,
        });
      } else {
        await ctx.db.insert("habits", {
          userId: args.userId,
          ...habit,
        });
      }
    }
  },
});

export const pushCompletions = mutation({
  args: {
    userId: v.string(),
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
    for (const completion of args.completions) {
      const existing = await ctx.db
        .query("completions")
        .withIndex("by_externalId", (q) => q.eq("externalId", completion.externalId))
        .first();

      if (!existing) {
        await ctx.db.insert("completions", {
          userId: args.userId,
          ...completion,
        });
      }
    }
  },
});

export const pushBadges = mutation({
  args: {
    userId: v.string(),
    badges: v.array(
      v.object({
        externalId: v.string(),
        badgeType: v.string(),
        earnedAt: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const badge of args.badges) {
      const existing = await ctx.db
        .query("badges")
        .withIndex("by_externalId", (q) => q.eq("externalId", badge.externalId))
        .first();

      if (!existing) {
        await ctx.db.insert("badges", {
          userId: args.userId,
          ...badge,
        });
      }
    }
  },
});

export const pushUserProfile = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    characterName: v.string(),
    characterClass: v.string(),
    xp: v.number(),
    level: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        characterName: args.characterName,
        characterClass: args.characterClass,
        xp: args.xp,
        level: args.level,
      });
    }
  },
});

export const pullHabits = query({
  args: {
    userId: v.string(),
    since: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let habits;
    if (args.since) {
      habits = await ctx.db
        .query("habits")
        .withIndex("by_userId_updatedAt", (q) =>
          q.eq("userId", args.userId).gt("updatedAt", args.since!)
        )
        .collect();
    } else {
      habits = await ctx.db
        .query("habits")
        .withIndex("by_userId_updatedAt", (q) => q.eq("userId", args.userId))
        .collect();
    }
    return habits;
  },
});

export const pullCompletions = query({
  args: {
    userId: v.string(),
    since: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let completions;
    if (args.since) {
      completions = await ctx.db
        .query("completions")
        .withIndex("by_userId_completedAt", (q) =>
          q.eq("userId", args.userId).gt("completedAt", args.since!)
        )
        .collect();
    } else {
      completions = await ctx.db
        .query("completions")
        .withIndex("by_userId_completedAt", (q) => q.eq("userId", args.userId))
        .collect();
    }
    return completions;
  },
});
