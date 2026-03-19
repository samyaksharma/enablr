import { Recurrence } from '../types';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

export function isScheduledForDate(recurrence: Recurrence, date: Date, habitCreatedAt: string): boolean {
  switch (recurrence.type) {
    case 'daily':
      return true;

    case 'specific_days': {
      const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      return recurrence.days?.includes(dayOfWeek) ?? false;
    }

    case 'interval': {
      const interval = recurrence.every ?? 1;
      const createdDate = startOfDay(new Date(habitCreatedAt));
      const targetDate = startOfDay(date);
      const daysDiff = differenceInCalendarDays(targetDate, createdDate);
      return daysDiff >= 0 && daysDiff % interval === 0;
    }

    default:
      return false;
  }
}
