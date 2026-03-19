import { calculateXp } from '../../src/services/rpg/xpCalculator';
import { Difficulty } from '../../src/types';

describe('calculateXp', () => {
  describe('base XP without streak', () => {
    it('returns 10 XP for Easy difficulty with no streak', () => {
      expect(calculateXp(Difficulty.Easy, 0)).toBe(10);
    });

    it('returns 25 XP for Medium difficulty with no streak', () => {
      expect(calculateXp(Difficulty.Medium, 0)).toBe(25);
    });

    it('returns 50 XP for Hard difficulty with no streak', () => {
      expect(calculateXp(Difficulty.Hard, 0)).toBe(50);
    });
  });

  describe('streak multipliers', () => {
    it('applies 10% bonus at 3-day streak', () => {
      expect(calculateXp(Difficulty.Easy, 3)).toBe(11);
      expect(calculateXp(Difficulty.Medium, 3)).toBe(27);
      expect(calculateXp(Difficulty.Hard, 3)).toBe(55);
    });

    it('applies 25% bonus at 7-day streak', () => {
      expect(calculateXp(Difficulty.Easy, 7)).toBe(12);
      expect(calculateXp(Difficulty.Medium, 7)).toBe(31);
      expect(calculateXp(Difficulty.Hard, 7)).toBe(62);
    });

    it('applies 50% bonus at 30-day streak', () => {
      expect(calculateXp(Difficulty.Easy, 30)).toBe(15);
      expect(calculateXp(Difficulty.Medium, 30)).toBe(37);
      expect(calculateXp(Difficulty.Hard, 30)).toBe(75);
    });

    it('still applies 10% bonus at 5-day streak (between 3 and 7)', () => {
      expect(calculateXp(Difficulty.Medium, 5)).toBe(27);
    });

    it('still applies 25% bonus at 15-day streak (between 7 and 30)', () => {
      expect(calculateXp(Difficulty.Medium, 15)).toBe(31);
    });

    it('applies 50% bonus at 100-day streak (above 30)', () => {
      expect(calculateXp(Difficulty.Hard, 100)).toBe(75);
    });

    it('no bonus at 1-day streak', () => {
      expect(calculateXp(Difficulty.Easy, 1)).toBe(10);
    });

    it('no bonus at 2-day streak', () => {
      expect(calculateXp(Difficulty.Hard, 2)).toBe(50);
    });
  });
});
