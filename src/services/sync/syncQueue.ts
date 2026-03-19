import { getDatabase } from '../../db/database';
import { completionRepository } from '../../db/repositories/completionRepository';
import { badgeRepository } from '../../db/repositories/badgeRepository';
import { habitRepository } from '../../db/repositories/habitRepository';
import { useAuthStore } from '../../stores/authStore';
import { Completion, Badge, Habit } from '../../types';

export interface SyncQueueData {
  completions: Completion[];
  badges: Badge[];
  habits: Habit[];
}

export const syncQueue = {
  async getUnsyncedData(): Promise<SyncQueueData> {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { completions: [], badges: [], habits: [] };

    const db = await getDatabase();

    const [completions, badges, habits] = await Promise.all([
      completionRepository.getUnsynced(db),
      badgeRepository.getUnsynced(db),
      habitRepository.getUnsynced(db, userId),
    ]);

    return { completions, badges, habits };
  },

  async markCompletionSynced(completionId: string): Promise<void> {
    const db = await getDatabase();
    await completionRepository.markSynced(db, completionId);
  },

  async markBadgeSynced(badgeId: string): Promise<void> {
    const db = await getDatabase();
    await badgeRepository.markSynced(db, badgeId);
  },

  async markHabitSynced(habitId: string): Promise<void> {
    const db = await getDatabase();
    await habitRepository.markSynced(db, habitId);
  },
};
