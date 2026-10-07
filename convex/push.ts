import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

export const tokens = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const result: string[] = [];
    for (const userId of new Set(args.userIds)) {
      const user = await ctx.db.get(userId);
      if (user?.pushToken) result.push(user.pushToken);
    }
    return result;
  },
});

// Delivers a notification through the Expo Push Service. Users without a
// registered device are skipped; a failed send is logged and never retried.
export const send = internalAction({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    const to: string[] = await ctx.runQuery(internal.push.tokens, { userIds: args.userIds });
    if (to.length === 0) return;

    for (let i = 0; i < to.length; i += 100) {
      const messages = to.slice(i, i + 100).map((token) => ({
        to: token,
        title: args.title,
        body: args.body,
        data: args.data ?? {},
        sound: "default",
        channelId: "default",
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      if (!response.ok) {
        console.error("Expo push failed", response.status, await response.text());
      }
    }
  },
});
