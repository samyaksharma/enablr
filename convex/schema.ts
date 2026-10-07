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
    // Minutes to add to UTC to get the user's local time; used to time reminders
    utcOffsetMinutes: v.optional(v.number()),
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
    reminderEnabled: v.optional(v.boolean()),
    archived: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
    clientId: v.string(),
    localVersion: v.number(),
    // Server clock at the time the row was last written; the pull cursor
    serverUpdatedAt: v.optional(v.number()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_serverUpdatedAt", ["userId", "serverUpdatedAt"]),

  completions: defineTable({
    userId: v.string(),
    externalId: v.string(),
    habitId: v.string(),
    completedAt: v.string(),
    xpEarned: v.number(),
    clientId: v.string(),
    localVersion: v.number(),
    serverUpdatedAt: v.optional(v.number()),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId_completedAt", ["userId", "completedAt"])
    .index("by_userId_serverUpdatedAt", ["userId", "serverUpdatedAt"]),

  badges: defineTable({
    userId: v.string(),
    externalId: v.string(),
    badgeType: v.string(),
    earnedAt: v.string(),
  })
    .index("by_externalId", ["externalId"])
    .index("by_userId", ["userId"]),

  guilds: defineTable({
    name: v.string(),
    nameLower: v.string(),
    description: v.string(),
    emblemId: v.optional(v.id("_storage")),
    ownerId: v.id("users"),
    memberCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Set when the owner deletes the guild; purged after the grace period
    deletedAt: v.optional(v.number()),
  })
    .index("by_nameLower", ["nameLower"])
    .index("by_owner", ["ownerId"])
    .index("by_deletedAt", ["deletedAt"])
    .searchIndex("search_name", { searchField: "name" }),

  guildRoles: defineTable({
    guildId: v.id("guilds"),
    name: v.string(),
    color: v.string(),
    iconId: v.optional(v.id("_storage")),
    // Lower number = higher rank. Owner is 0.
    position: v.number(),
    permissions: v.array(v.string()),
    system: v.optional(
      v.union(v.literal("owner"), v.literal("admin"), v.literal("mod"), v.literal("member"))
    ),
  }).index("by_guild", ["guildId"]),

  guildMembers: defineTable({
    guildId: v.id("guilds"),
    userId: v.id("users"),
    roleId: v.id("guildRoles"),
    xp: v.number(),
    level: v.number(),
    joinedAt: v.number(),
    muted: v.optional(v.boolean()),
    // Set when the member leaves or is removed; XP is kept for a rejoin
    leftAt: v.optional(v.number()),
  })
    .index("by_guild", ["guildId"])
    .index("by_user", ["userId"])
    .index("by_guild_user", ["guildId", "userId"]),

  guildJoinRequests: defineTable({
    guildId: v.id("guilds"),
    userId: v.id("users"),
    message: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("cancelled")
    ),
    decidedBy: v.optional(v.id("users")),
    decidedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_guild_status", ["guildId", "status"])
    .index("by_guild_user", ["guildId", "userId"])
    .index("by_user_status", ["userId", "status"]),

  guildTasks: defineTable({
    guildId: v.id("guilds"),
    createdBy: v.id("users"),
    name: v.string(),
    description: v.string(),
    difficulty: v.string(),
    // null for a one-off task; otherwise { type, days?, every? } as for habits
    recurrence: v.union(v.null(), v.any()),
    dueAt: v.optional(v.number()),
    assignment: v.union(
      v.object({ type: v.literal("everyone") }),
      v.object({ type: v.literal("role"), roleId: v.id("guildRoles") }),
      v.object({ type: v.literal("members"), userIds: v.array(v.id("users")) })
    ),
    rewardMode: v.union(v.literal("on_submission"), v.literal("on_review")),
    proofVideoRequired: v.boolean(),
    archived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_guild", ["guildId"]),

  guildTaskSubmissions: defineTable({
    taskId: v.id("guildTasks"),
    guildId: v.id("guilds"),
    userId: v.id("users"),
    // "once" for a one-off task, or the local day ("YYYY-MM-DD") for a recurring one
    occurrence: v.string(),
    status: v.union(
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("revoked")
    ),
    videoId: v.optional(v.id("_storage")),
    xpAwarded: v.number(),
    reviewedBy: v.optional(v.id("users")),
    reviewNote: v.optional(v.string()),
    submittedAt: v.number(),
    // When the submission reached approved / rejected / revoked
    resolvedAt: v.optional(v.number()),
  })
    .index("by_task_user", ["taskId", "userId"])
    .index("by_guild_status", ["guildId", "status"])
    .index("by_guild_user", ["guildId", "userId"])
    .index("by_resolvedAt", ["resolvedAt"]),

  reports: defineTable({
    reporterId: v.id("users"),
    guildId: v.id("guilds"),
    submissionId: v.optional(v.id("guildTaskSubmissions")),
    reason: v.string(),
    createdAt: v.number(),
  }).index("by_guild", ["guildId"]),
});
