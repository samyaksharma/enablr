import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsertUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    characterName: v.optional(v.string()),
    characterClass: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        ...(args.email && { email: args.email }),
        ...(args.characterName && { characterName: args.characterName }),
        ...(args.characterClass && { characterClass: args.characterClass }),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: args.tokenIdentifier,
      name: args.name,
      email: args.email,
      characterName: args.characterName ?? "",
      characterClass: args.characterClass ?? "warrior",
      xp: 0,
      level: 1,
    });
  },
});

export const updatePushToken = mutation({
  args: {
    tokenIdentifier: v.string(),
    pushToken: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        pushToken: args.pushToken,
        pushTokenUpdatedAt: new Date().toISOString(),
      });
    }
  },
});

export const currentUser = query({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", args.tokenIdentifier))
      .first();
  },
});
