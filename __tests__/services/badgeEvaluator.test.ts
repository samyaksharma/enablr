import { evaluateBadges, BadgeContext } from '../../src/services/rpg/badgeEvaluator';
import { BadgeType } from '../../src/types';

function makeContext(overrides: Partial<BadgeContext> = {}): BadgeContext {
  return {
    totalCompletions: 0,
    habitStreaks: new Map(),
    activeHabitCount: 0,
    allTodayHabitsCompleted: false,
    todayHabitCount: 0,
    currentLevel: 1,
    earnedBadges: new Set(),
    ...overrides,
  };
}

describe('evaluateBadges', () => {
  it('returns empty array when no conditions met', () => {
    expect(evaluateBadges(makeContext())).toEqual([]);
  });

  describe('FirstStep', () => {
    it('awards FirstStep on first completion', () => {
      const badges = evaluateBadges(makeContext({ totalCompletions: 1 }));
      expect(badges).toContain(BadgeType.FirstStep);
    });

    it('does not re-award FirstStep if already earned', () => {
      const badges = evaluateBadges(
        makeContext({
          totalCompletions: 5,
          earnedBadges: new Set([BadgeType.FirstStep]),
        })
      );
      expect(badges).not.toContain(BadgeType.FirstStep);
    });
  });

  describe('Consistent', () => {
    it('awards Consistent when any habit has 7-day streak', () => {
      const streaks = new Map([['habit1', 7]]);
      const badges = evaluateBadges(makeContext({ habitStreaks: streaks }));
      expect(badges).toContain(BadgeType.Consistent);
    });

    it('does not award at 6-day streak', () => {
      const streaks = new Map([['habit1', 6]]);
      const badges = evaluateBadges(makeContext({ habitStreaks: streaks }));
      expect(badges).not.toContain(BadgeType.Consistent);
    });
  });

  describe('Dedicated', () => {
    it('awards Dedicated when any habit has 30-day streak', () => {
      const streaks = new Map([['habit1', 30]]);
      const badges = evaluateBadges(makeContext({ habitStreaks: streaks }));
      expect(badges).toContain(BadgeType.Dedicated);
    });

    it('does not award at 29-day streak', () => {
      const streaks = new Map([['habit1', 29]]);
      const badges = evaluateBadges(makeContext({ habitStreaks: streaks }));
      expect(badges).not.toContain(BadgeType.Dedicated);
    });
  });

  describe('Collector', () => {
    it('awards Collector with 5 active habits', () => {
      const badges = evaluateBadges(makeContext({ activeHabitCount: 5 }));
      expect(badges).toContain(BadgeType.Collector);
    });

    it('does not award with 4 active habits', () => {
      const badges = evaluateBadges(makeContext({ activeHabitCount: 4 }));
      expect(badges).not.toContain(BadgeType.Collector);
    });
  });

  describe('Overachiever', () => {
    it('awards Overachiever when all today habits completed', () => {
      const badges = evaluateBadges(
        makeContext({
          todayHabitCount: 3,
          allTodayHabitsCompleted: true,
        })
      );
      expect(badges).toContain(BadgeType.Overachiever);
    });

    it('does not award if no habits today', () => {
      const badges = evaluateBadges(
        makeContext({
          todayHabitCount: 0,
          allTodayHabitsCompleted: false,
        })
      );
      expect(badges).not.toContain(BadgeType.Overachiever);
    });
  });

  describe('Veteran', () => {
    it('awards Veteran at level 10', () => {
      const badges = evaluateBadges(makeContext({ currentLevel: 10 }));
      expect(badges).toContain(BadgeType.Veteran);
    });

    it('does not award at level 9', () => {
      const badges = evaluateBadges(makeContext({ currentLevel: 9 }));
      expect(badges).not.toContain(BadgeType.Veteran);
    });
  });

  describe('multiple badges', () => {
    it('can award multiple badges at once', () => {
      const badges = evaluateBadges(
        makeContext({
          totalCompletions: 1,
          activeHabitCount: 5,
          currentLevel: 10,
        })
      );
      expect(badges).toContain(BadgeType.FirstStep);
      expect(badges).toContain(BadgeType.Collector);
      expect(badges).toContain(BadgeType.Veteran);
      expect(badges).toHaveLength(3);
    });
  });
});
