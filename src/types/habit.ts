export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export enum HabitCategory {
  Health = 'health',
  Learning = 'learning',
  Mindfulness = 'mindfulness',
  Productivity = 'productivity',
  Custom = 'custom',
}

export type RecurrenceType = 'daily' | 'specific_days' | 'interval';

export interface Recurrence {
  type: RecurrenceType;
  days?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (for specific_days)
  every?: number; // interval in days (for interval)
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string;
  recurrence: Recurrence;
  category: HabitCategory;
  difficulty: Difficulty;
  archived: boolean;
  scheduledTime?: string; // HH:mm format
  createdAt: string;
  updatedAt: string;
  clientId: string;
  localVersion: number;
  synced: boolean;
}

export interface Completion {
  id: string;
  habitId: string;
  completedAt: string;
  xpEarned: number;
  synced: boolean;
  localVersion: number;
  clientId: string;
}
