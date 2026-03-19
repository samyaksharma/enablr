import { HabitCategory } from '../types';

export const CATEGORY_CONFIG: Record<
  HabitCategory,
  { label: string; icon: string; color: string }
> = {
  [HabitCategory.Health]: {
    label: 'Health',
    icon: 'heart',
    color: '#FF6B6B',
  },
  [HabitCategory.Learning]: {
    label: 'Learning',
    icon: 'book',
    color: '#4ECDC4',
  },
  [HabitCategory.Mindfulness]: {
    label: 'Mindfulness',
    icon: 'leaf',
    color: '#95E77E',
  },
  [HabitCategory.Productivity]: {
    label: 'Productivity',
    icon: 'zap',
    color: '#FFD93D',
  },
  [HabitCategory.Custom]: {
    label: 'Custom',
    icon: 'star',
    color: '#7C5CFC',
  },
};
