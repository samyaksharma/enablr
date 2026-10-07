import { internalMutation } from "./_generated/server";
import { LIMITS } from "./permissions";

const DAY_MS = 86400000;

// Deletes proof videos 30 days after their submission was resolved. The
// submission record and its outcome are kept.
export const purgeExpiredVideos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LIMITS.videoRetentionMs;
    // The job runs daily, so a three-day window catches everything newly expired
    const expired = await ctx.db
      .query("guildTaskSubmissions")
      .withIndex("by_resolvedAt", (q) =>
        q.gt("resolvedAt", cutoff - 3 * DAY_MS).lt("resolvedAt", cutoff)
      )
      .collect();
    for (const submission of expired) {
      if (!submission.videoId) continue;
      await ctx.storage.delete(submission.videoId);
      await ctx.db.patch(submission._id, { videoId: undefined });
    }
  },
});

// Permanently removes guilds whose 7-day restore period has run out, along with
// their roles, members, requests, tasks, submissions and uploaded files.
export const purgeDeletedGuilds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LIMITS.deleteGraceMs;
    const guilds = await ctx.db
      .query("guilds")
      .withIndex("by_deletedAt", (q) => q.gt("deletedAt", 0).lt("deletedAt", cutoff))
      .take(3);

    for (const guild of guilds) {
      const submissions = await ctx.db
        .query("guildTaskSubmissions")
        .withIndex("by_guild_status", (q) => q.eq("guildId", guild._id))
        .collect();
      for (const row of submissions) {
        if (row.videoId) await ctx.storage.delete(row.videoId);
        await ctx.db.delete(row._id);
      }
      const roles = await ctx.db
        .query("guildRoles")
        .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
        .collect();
      for (const row of roles) {
        if (row.iconId) await ctx.storage.delete(row.iconId);
        await ctx.db.delete(row._id);
      }
      const tasks = await ctx.db
        .query("guildTasks")
        .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
        .collect();
      const members = await ctx.db
        .query("guildMembers")
        .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
        .collect();
      const requests = await ctx.db
        .query("guildJoinRequests")
        .withIndex("by_guild_status", (q) => q.eq("guildId", guild._id))
        .collect();
      const reports = await ctx.db
        .query("reports")
        .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
        .collect();
      for (const row of [...tasks, ...members, ...requests, ...reports]) {
        await ctx.db.delete(row._id);
      }
      if (guild.emblemId) await ctx.storage.delete(guild.emblemId);
      await ctx.db.delete(guild._id);
    }
  },
});
