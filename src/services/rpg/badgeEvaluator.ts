import { BadgeType } from '../../types';

export interface BadgeContext {
  totalCompletions: number;
  habitStreaks: Map<string, number>; // habitId -> streak days
  activeHabitCount: number;
  allTodayHabitsCompleted: boolean;
  todayHabitCount: number;
  currentLevel: number;
  earnedBadges: Set<BadgeType>;
}

export function evaluateBadges(context: BadgeContext): BadgeType[] {
  const newBadges: BadgeType[] = [];

  // First Step: Complete any habit for the first time
  if (!context.earnedBadges.has(BadgeType.FirstStep) && context.totalCompletions >= 1) {
    newBadges.push(BadgeType.FirstStep);
  }

  // Consistent: Complete the same habit 7 days in a row
  if (!context.earnedBadges.has(BadgeType.Consistent)) {
    for (const streak of context.habitStreaks.values()) {
      if (streak >= 7) {
        newBadges.push(BadgeType.Consistent);
        break;
      }
    }
  }

  // Dedicated: Complete the same habit 30 days in a row
  if (!context.earnedBadges.has(BadgeType.Dedicated)) {
    for (const streak of context.habitStreaks.values()) {
      if (streak >= 30) {
        newBadges.push(BadgeType.Dedicated);
        break;
      }
    }
  }

  // Collector: Have 5 active habits simultaneously
  if (!context.earnedBadges.has(BadgeType.Collector) && context.activeHabitCount >= 5) {
    newBadges.push(BadgeType.Collector);
  }

  // Overachiever: Complete all habits in a single day
  if (
    !context.earnedBadges.has(BadgeType.Overachiever) &&
    context.todayHabitCount > 0 &&
    context.allTodayHabitsCompleted
  ) {
    newBadges.push(BadgeType.Overachiever);
  }

  // Veteran: Reach Level 10
  if (!context.earnedBadges.has(BadgeType.Veteran) && context.currentLevel >= 10) {
    newBadges.push(BadgeType.Veteran);
  }

  return newBadges;
}
