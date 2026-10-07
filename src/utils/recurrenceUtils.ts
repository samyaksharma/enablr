import { Recurrence } from '../types';
import { countStreak, dayNumber, isScheduledOnDay, toDayKey } from './schedule';
import { addDays, differenceInCalendarDays, format, startOfDay } from 'date-fns';

export function isScheduledForDate(recurrence: Recurrence, date: Date, habitCreatedAt: string): boolean {
  return isScheduledOnDay(
    recurrence,
    dayNumber(toDayKey(date)),
    dayNumber(toDayKey(new Date(habitCreatedAt)))
  );
}

// Consecutive scheduled days completed, up to and including today. Days the
// habit isn't due don't break the streak.
export function getHabitStreak(
  completionDates: string[],
  habit: { recurrence: Recurrence; createdAt: string },
  today: Date = new Date()
): number {
  const done = new Set(completionDates.map((d) => dayNumber(toDayKey(new Date(d)))));
  return countStreak(
    done,
    habit.recurrence,
    dayNumber(toDayKey(new Date(habit.createdAt))),
    dayNumber(toDayKey(today))
  );
}

// The next day after `from` on which the habit is due, or null if it never recurs
// (e.g. "specific days" with no days selected).
export function getNextScheduledDate(
  recurrence: Recurrence,
  habitCreatedAt: string,
  from: Date = new Date()
): Date | null {
  const start = startOfDay(from);
  for (let offset = 1; offset <= 366; offset++) {
    const candidate = addDays(start, offset);
    if (isScheduledForDate(recurrence, candidate, habitCreatedAt)) {
      return candidate;
    }
  }
  return null;
}

export function formatNextScheduled(next: Date | null, from: Date = new Date()): string {
  if (!next) return 'No days selected';
  const daysAway = differenceInCalendarDays(next, startOfDay(from));
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway < 7) return format(next, 'EEEE');
  return format(next, 'MMM d');
}
