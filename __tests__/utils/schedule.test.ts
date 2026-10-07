import {
  countStreak,
  dayNumber,
  isDayKey,
  isScheduledOnDay,
  toDayKey,
  weekdayOf,
} from '../../src/utils/schedule';
import { getHabitStreak } from '../../src/utils/recurrenceUtils';
import { roleHasPermission, SYSTEM_ROLES } from '../../convex/permissions';

const day = (key: string) => dayNumber(key);
const done = (...keys: string[]) => new Set(keys.map(day));

describe('day keys', () => {
  it('validates and numbers calendar days', () => {
    expect(isDayKey('2026-10-05')).toBe(true);
    expect(isDayKey('2026-10-5')).toBe(false);
    expect(isDayKey('once')).toBe(false);
    expect(day('2026-10-06') - day('2026-10-05')).toBe(1);
    // 5 October 2026 is a Monday
    expect(weekdayOf(day('2026-10-05'))).toBe(1);
    expect(toDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

describe('isScheduledOnDay', () => {
  it('handles each recurrence type', () => {
    const created = day('2026-10-01');
    expect(isScheduledOnDay({ type: 'daily' }, day('2026-10-05'), created)).toBe(true);
    expect(isScheduledOnDay({ type: 'specific_days', days: [2, 4] }, day('2026-10-05'), created)).toBe(false);
    expect(isScheduledOnDay({ type: 'specific_days', days: [2, 4] }, day('2026-10-06'), created)).toBe(true);
    expect(isScheduledOnDay({ type: 'interval', every: 3 }, day('2026-10-04'), created)).toBe(true);
    expect(isScheduledOnDay({ type: 'interval', every: 3 }, day('2026-10-05'), created)).toBe(false);
    expect(isScheduledOnDay({ type: 'interval', every: 3 }, day('2026-09-28'), created)).toBe(false);
  });
});

describe('countStreak', () => {
  const created = day('2026-09-01');

  it('counts consecutive days for a daily habit', () => {
    const streak = countStreak(
      done('2026-10-03', '2026-10-04', '2026-10-05'),
      { type: 'daily' },
      created,
      day('2026-10-05')
    );
    expect(streak).toBe(3);
  });

  it('keeps the streak alive until today is over', () => {
    const streak = countStreak(done('2026-10-03', '2026-10-04'), { type: 'daily' }, created, day('2026-10-05'));
    expect(streak).toBe(2);
  });

  it('breaks on a missed scheduled day', () => {
    const streak = countStreak(done('2026-10-02', '2026-10-05'), { type: 'daily' }, created, day('2026-10-05'));
    expect(streak).toBe(1);
  });

  it('does not break on days the habit is not due', () => {
    // Tuesdays and Thursdays only
    const rule = { type: 'specific_days' as const, days: [2, 4] };
    const streak = countStreak(
      done('2026-09-29', '2026-10-01', '2026-10-06'),
      rule,
      created,
      day('2026-10-06')
    );
    expect(streak).toBe(3);
  });

  it('follows an interval from the creation day', () => {
    const rule = { type: 'interval' as const, every: 2 };
    const streak = countStreak(
      done('2026-10-01', '2026-10-03', '2026-10-05'),
      rule,
      day('2026-10-01'),
      day('2026-10-05')
    );
    expect(streak).toBe(3);
  });
});

describe('getHabitStreak', () => {
  it('builds a streak from completion timestamps on scheduled days', () => {
    const habit = {
      recurrence: { type: 'specific_days' as const, days: [1, 3, 5] },
      createdAt: new Date(2026, 8, 1, 9).toISOString(),
    };
    const completions = [
      new Date(2026, 9, 5, 8).toISOString(), // Mon
      new Date(2026, 9, 2, 21).toISOString(), // Fri
      new Date(2026, 8, 30, 7).toISOString(), // Wed
    ];
    expect(getHabitStreak(completions, habit, new Date(2026, 9, 5, 12))).toBe(3);
  });
});

describe('role permissions', () => {
  const role = (system: string) => SYSTEM_ROLES.find((r) => r.system === system)!;

  it('gives the Owner everything and the Member nothing beyond tasks', () => {
    expect(roleHasPermission(role('owner'), 'manage_roles')).toBe(true);
    expect(roleHasPermission(role('member'), 'manage_requests')).toBe(false);
  });

  it('lets Mods review and manage requests but not edit the guild or roles', () => {
    expect(roleHasPermission(role('mod'), 'review_submissions')).toBe(true);
    expect(roleHasPermission(role('mod'), 'manage_requests')).toBe(true);
    expect(roleHasPermission(role('mod'), 'edit_guild')).toBe(false);
    expect(roleHasPermission(role('mod'), 'assign_roles')).toBe(false);
  });
});
