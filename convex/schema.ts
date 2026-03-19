import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    // Convex Auth fields (set automatically on sign-up)
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.float64()),
    isAnonymous: v.optional(v.boolean()),
    tokenIdentifier: v.optional(v.string()),
    // App-specific fields (set later during onboarding)
    name: v.optional(v.string()),
    characterName: v.optional(v.string()),
    characterClass: v.optional(v.string()),
    xp: v.optional(v.float64()),
    level: v.optional(v.float64()),
    pushToken: v.optional(v.string()),
    pushTokenUpdatedAt: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"]),

  habits: defineTable({
    userId: v.string(),
    externalId: v.string(),
    name: v.string(),
    description: v.string(),
    recurrence: v.any(), // JSON object: { type, days?, every? }
    category: v.string(),
    difficulty: v.string(),
    scheduledTime: v.optional(v.string()),
    archived: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
    clientId: v.string(),
    localVersion: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"]),

  completions: defineTable({
    userId: v.string(),
    externalId: v.string(),
    habitId: v.string(),
    completedAt: v.string(),
    xpEarned: v.number(),
    clientId: v.string(),
    localVersion: v.number(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId_completedAt", ["userId", "completedAt"]),

  badges: defineTable({
    userId: v.string(),
    externalId: v.string(),
    badgeType: v.string(),
    earnedAt: v.string(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId", ["userId"]),
});
