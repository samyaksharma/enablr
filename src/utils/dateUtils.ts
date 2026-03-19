import { startOfDay, differenceInCalendarDays, isSameDay, subDays } from 'date-fns';

export function getToday(): Date {
  return startOfDay(new Date());
}

export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isSameDay(d, new Date());
}

export function getStreakDays(completionDates: string[]): number {
  if (completionDates.length === 0) return 0;

  const sorted = completionDates
    .map((d) => startOfDay(new Date(d)))
    .sort((a, b) => b.getTime() - a.getTime());

  // Deduplicate by day
  const uniqueDays: Date[] = [];
  for (const d of sorted) {
    if (uniqueDays.length === 0 || !isSameDay(d, uniqueDays[uniqueDays.length - 1])) {
      uniqueDays.push(d);
    }
  }

  const today = startOfDay(new Date());

  // Streak must include today or yesterday to be active
  if (uniqueDays.length === 0) return 0;
  const mostRecent = uniqueDays[0];
  const daysSinceLast = differenceInCalendarDays(today, mostRecent);
  if (daysSinceLast > 1) return 0;

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const diff = differenceInCalendarDays(uniqueDays[i - 1], uniqueDays[i]);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getDayBoundary(): { start: Date; end: Date } {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
