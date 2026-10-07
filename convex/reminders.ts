import { internalMutation } from "./_generated/server";
import { notify } from "./lib/access";
import { RecurrenceRule, dayNumber, isScheduledOnDay } from "../src/utils/schedule";

const DAY_MS = 86400000;
const STREAK_AT_RISK_HOUR = 22; // two hours before midnight
const WEEKLY_SUMMARY_HOUR = 18; // Sunday evening

// Runs every hour and sends the reminders whose local time has come round for
// each user. A user's local clock is UTC shifted by the offset their device
// last reported.
export const hourlyTick = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      if (!user.pushToken || user.utcOffsetMinutes === undefined) continue;
      const offsetMs = user.utcOffsetMinutes * 60000;
      const local = new Date(now + offsetMs);
      const hour = local.getUTCHours();
      const streakDue = hour === STREAK_AT_RISK_HOUR;
      const summaryDue = local.getUTCDay() === 0 && hour === WEEKLY_SUMMARY_HOUR;
      if (!streakDue && !summaryDue) continue;

      const today = Math.floor((now + offsetMs) / DAY_MS);
      const localMidnightUtc = today * DAY_MS - offsetMs;

      if (streakDue) {
        const habits = await ctx.db
          .query("habits")
          .withIndex("by_userId_updatedAt", (q) => q.eq("userId", user._id))
          .collect();
        const completions = await ctx.db
          .query("completions")
          .withIndex("by_userId_completedAt", (q) =>
            q.eq("userId", user._id).gte("completedAt", new Date(localMidnightUtc).toISOString())
          )
          .collect();
        const doneToday = new Set(completions.map((c) => c.habitId));

        const waiting = habits.filter((habit) => {
          if (habit.archived || habit.reminderEnabled === false) return false;
          if (doneToday.has(habit.externalId)) return false;
          const createdLocal = new Date(new Date(habit.createdAt).getTime() + offsetMs);
          const createdDay = dayNumber(createdLocal.toISOString().slice(0, 10));
          return isScheduledOnDay(habit.recurrence as RecurrenceRule, today, createdDay);
        });
        if (waiting.length > 0) {
          await notify(
            ctx,
            [user._id],
            "Streak at risk",
            waiting.length === 1
              ? `"${waiting[0].name}" is still waiting. Two hours left to keep your streak.`
              : `${waiting.length} habits are still waiting. Two hours left to keep your streaks.`
          );
        }
      }

      if (summaryDue) {
        const week = await ctx.db
          .query("completions")
          .withIndex("by_userId_completedAt", (q) =>
            q
              .eq("userId", user._id)
              .gte("completedAt", new Date(localMidnightUtc - 6 * DAY_MS).toISOString())
          )
          .collect();
        if (week.length > 0) {
          const xp = week.reduce((sum, c) => sum + c.xpEarned, 0);
          const noun = week.length === 1 ? "habit" : "habits";
          await notify(
            ctx,
            [user._id],
            "Your week in review",
            `You completed ${week.length} ${noun} this week, earning ${xp} XP.`
          );
        }
      }
    }
  },
});
