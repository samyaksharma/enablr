// Pure scheduling maths shared by the app and the Convex functions.
// Works on calendar days ("YYYY-MM-DD" keys and day numbers), never on clock
// time, so it gives the same answer on the device and on the server.

export interface RecurrenceRule {
  type: 'daily' | 'specific_days' | 'interval';
  days?: number[]; // 0=Sun ... 6=Sat
  every?: number; // interval in days
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(value: string): boolean {
  return DAY_KEY.test(value) && !Number.isNaN(dayNumber(value));
}

// The device's local calendar day for a moment in time.
export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Days since 1970-01-01 for a calendar day.
export function dayNumber(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function weekdayOf(day: number): number {
  // 1970-01-01 was a Thursday
  return (((day + 4) % 7) + 7) % 7;
}

export function isScheduledOnDay(rule: RecurrenceRule, day: number, createdDay: number): boolean {
  switch (rule.type) {
    case 'daily':
      return true;
    case 'specific_days':
      return rule.days?.includes(weekdayOf(day)) ?? false;
    case 'interval': {
      const every = Math.max(1, rule.every ?? 1);
      const diff = day - createdDay;
      return diff >= 0 && diff % every === 0;
    }
    default:
      return false;
  }
}

// Number of consecutive scheduled days completed, counting back from `today`.
// Days the rule doesn't schedule are skipped rather than breaking the streak,
// and today only counts once it has been completed.
export function countStreak(
  doneDays: Set<number>,
  rule: RecurrenceRule,
  createdDay: number,
  today: number
): number {
  let streak = 0;
  for (let day = today; day >= today - 1500; day--) {
    if (!isScheduledOnDay(rule, day, createdDay)) continue;
    if (doneDays.has(day)) {
      streak++;
    } else if (day !== today) {
      break;
    }
  }
  return streak;
}
