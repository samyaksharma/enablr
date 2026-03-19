import { BadgeDefinition, BadgeType, Difficulty } from '../types';

export const BASE_XP: Record<Difficulty, number> = {
  [Difficulty.Easy]: 10,
  [Difficulty.Medium]: 25,
  [Difficulty.Hard]: 50,
};

export const STREAK_MULTIPLIERS: { minDays: number; multiplier: number }[] = [
  { minDays: 30, multiplier: 1.5 },
  { minDays: 7, multiplier: 1.25 },
  { minDays: 3, multiplier: 1.1 },
];

export const MAX_LEVEL = 20;

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    type: BadgeType.FirstStep,
    name: 'First Step',
    description: 'Complete any habit for the first time',
    hint: 'Complete your first habit to unlock',
  },
  {
    type: BadgeType.Consistent,
    name: 'Consistent',
    description: 'Complete the same habit 7 days in a row',
    hint: 'Keep a 7-day streak on any habit',
  },
  {
    type: BadgeType.Dedicated,
    name: 'Dedicated',
    description: 'Complete the same habit 30 days in a row',
    hint: 'Keep a 30-day streak on any habit',
  },
  {
    type: BadgeType.Collector,
    name: 'Collector',
    description: 'Have 5 active habits simultaneously',
    hint: 'Create 5 active habits',
  },
  {
    type: BadgeType.Overachiever,
    name: 'Overachiever',
    description: 'Complete all habits in a single day',
    hint: 'Complete every habit scheduled for today',
  },
  {
    type: BadgeType.Veteran,
    name: 'Veteran',
    description: 'Reach Level 10',
    hint: 'Keep leveling up to reach Level 10',
  },
];
