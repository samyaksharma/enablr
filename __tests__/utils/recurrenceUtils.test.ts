import {
  formatNextScheduled,
  getNextScheduledDate,
  isScheduledForDate,
} from '../../src/utils/recurrenceUtils';
import { Recurrence } from '../../src/types';

// Monday
const monday = new Date(2026, 9, 5, 15, 0, 0);
const createdAt = new Date(2026, 9, 5, 9, 0, 0).toISOString();

describe('getNextScheduledDate', () => {
  it('finds the next selected weekday for a habit not due today', () => {
    const recurrence: Recurrence = { type: 'specific_days', days: [6, 0, 2, 4] };
    expect(isScheduledForDate(recurrence, monday, createdAt)).toBe(false);

    const next = getNextScheduledDate(recurrence, createdAt, monday);
    expect(next?.getDay()).toBe(2);
    expect(formatNextScheduled(next, monday)).toBe('Tomorrow');
  });

  it('names the weekday when it is more than a day away', () => {
    const recurrence: Recurrence = { type: 'specific_days', days: [4] };
    const next = getNextScheduledDate(recurrence, createdAt, monday);
    expect(formatNextScheduled(next, monday)).toBe('Thursday');
  });

  it('follows the interval from the creation date', () => {
    const recurrence: Recurrence = { type: 'interval', every: 10 };
    const next = getNextScheduledDate(recurrence, createdAt, monday);
    expect(next?.getDate()).toBe(15);
    expect(formatNextScheduled(next, monday)).toBe('Oct 15');
  });

  it('returns null when no days are selected', () => {
    const recurrence: Recurrence = { type: 'specific_days', days: [] };
    const next = getNextScheduledDate(recurrence, createdAt, monday);
    expect(next).toBeNull();
    expect(formatNextScheduled(next, monday)).toBe('No days selected');
  });
});
