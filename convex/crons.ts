import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly("habit reminders", { minuteUTC: 0 }, internal.reminders.hourlyTick);
crons.daily(
  "purge expired proof videos",
  { hourUTC: 3, minuteUTC: 15 },
  internal.maintenance.purgeExpiredVideos
);
crons.daily(
  "purge deleted guilds",
  { hourUTC: 3, minuteUTC: 45 },
  internal.maintenance.purgeDeletedGuilds
);

export default crons;
