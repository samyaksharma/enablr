import { Difficulty } from '../../types';
import { BASE_XP, STREAK_MULTIPLIERS } from '../../constants/rpg';

export function calculateXp(difficulty: Difficulty, streakDays: number): number {
  const base = BASE_XP[difficulty];

  let multiplier = 1;
  for (const { minDays, multiplier: m } of STREAK_MULTIPLIERS) {
    if (streakDays >= minDays) {
      multiplier = m;
      break;
    }
  }

  return Math.floor(base * multiplier);
}
