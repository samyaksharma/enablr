import { MAX_LEVEL } from '../../constants/rpg';

// Total XP required to reach a level (Level N requires N² × 100 XP).
export function getXpForLevel(level: number): number {
  return level * level * 100;
}

export function getLevelForXp(totalXp: number): number {
  // Everyone starts at level 1, so only levels 2+ have a threshold to meet.
  for (let level = MAX_LEVEL; level > 1; level--) {
    if (totalXp >= getXpForLevel(level)) {
      return level;
    }
  }
  return 1;
}

export function getXpProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  progress: number;
} {
  const level = getLevelForXp(totalXp);

  if (level >= MAX_LEVEL) {
    const maxXp = getXpForLevel(MAX_LEVEL);
    return {
      level: MAX_LEVEL,
      currentLevelXp: maxXp,
      nextLevelXp: maxXp,
      xpIntoLevel: 0,
      progress: 1,
    };
  }

  const currentLevelXp = level <= 1 ? 0 : getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const xpIntoLevel = totalXp - currentLevelXp;
  const xpNeeded = nextLevelXp - currentLevelXp;
  const progress = xpNeeded > 0 ? xpIntoLevel / xpNeeded : 1;

  return { level, currentLevelXp, nextLevelXp, xpIntoLevel, progress };
}
