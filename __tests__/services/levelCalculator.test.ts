import {
  getLevelForXp,
  getXpForLevel,
  getXpProgress,
} from '../../src/services/rpg/levelCalculator';

describe('getXpForLevel', () => {
  it('returns correct XP thresholds', () => {
    expect(getXpForLevel(1)).toBe(100);
    expect(getXpForLevel(2)).toBe(400);
    expect(getXpForLevel(3)).toBe(900);
    expect(getXpForLevel(5)).toBe(2500);
    expect(getXpForLevel(10)).toBe(10000);
    expect(getXpForLevel(20)).toBe(40000);
  });
});

describe('getLevelForXp', () => {
  it('returns level 1 for 0 XP', () => {
    expect(getLevelForXp(0)).toBe(1);
  });

  it('returns level 1 for XP below level 1 threshold', () => {
    expect(getLevelForXp(50)).toBe(1);
  });

  it('returns level 1 at exactly 100 XP', () => {
    expect(getLevelForXp(100)).toBe(1);
  });

  it('returns level 2 at 400 XP', () => {
    expect(getLevelForXp(400)).toBe(2);
  });

  it('returns level 2 at 899 XP (just under level 3)', () => {
    expect(getLevelForXp(899)).toBe(2);
  });

  it('returns level 3 at 900 XP', () => {
    expect(getLevelForXp(900)).toBe(3);
  });

  it('returns level 10 at 10000 XP', () => {
    expect(getLevelForXp(10000)).toBe(10);
  });

  it('caps at level 20', () => {
    expect(getLevelForXp(40000)).toBe(20);
    expect(getLevelForXp(999999)).toBe(20);
  });
});

describe('getXpProgress', () => {
  it('shows correct progress at level 1', () => {
    const progress = getXpProgress(200);
    expect(progress.level).toBe(1);
    expect(progress.currentLevelXp).toBe(100);
    expect(progress.nextLevelXp).toBe(400);
    expect(progress.xpIntoLevel).toBe(100);
    expect(progress.progress).toBeCloseTo(100 / 300, 2);
  });

  it('shows 0 progress at exact level boundary', () => {
    const progress = getXpProgress(400);
    expect(progress.level).toBe(2);
    expect(progress.xpIntoLevel).toBe(0);
    expect(progress.progress).toBe(0);
  });

  it('shows full progress at max level', () => {
    const progress = getXpProgress(40000);
    expect(progress.level).toBe(20);
    expect(progress.progress).toBe(1);
  });
});
