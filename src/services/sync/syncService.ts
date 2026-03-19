import { convexHttpClient } from '../convex/convexClient';
import { api } from '../../../convex/_generated/api';
import { getDatabase } from '../../db/database';
import { habitRepository } from '../../db/repositories/habitRepository';
import { useSyncStore } from '../../stores/syncStore';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore } from '../../stores/habitStore';
import { syncQueue } from './syncQueue';
import { conflictResolver } from './conflictResolver';
import { Habit } from '../../types';

let isSyncing = false;

export const syncService = {
  async runSync(): Promise<void> {
    if (isSyncing) return;

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    if (!useSyncStore.getState().isConnected) return;

    isSyncing = true;
    useSyncStore.getState().setSyncing();

    try {
      // Push phase
      await pushUnsyncedData(userId);

      // Pull phase
      await pullRemoteChanges(userId);

      useSyncStore.getState().setSynced();

      // Refresh local state
      await useHabitStore.getState().loadHabits();
    } catch (error: any) {
      useSyncStore.getState().setError(error.message ?? 'Sync failed');
    } finally {
      isSyncing = false;
    }
  },
};

async function pushUnsyncedData(userId: string): Promise<void> {
  const data = await syncQueue.getUnsyncedData();

  // Push habits
  if (data.habits.length > 0) {
    await convexHttpClient.mutation(api.sync.pushHabits, {
      userId,
      habits: data.habits.map((habit) => ({
        externalId: habit.id,
        name: habit.name,
        description: habit.description,
        recurrence: habit.recurrence,
        category: habit.category,
        difficulty: habit.difficulty,
        scheduledTime: habit.scheduledTime ?? undefined,
        archived: habit.archived,
        createdAt: habit.createdAt,
        updatedAt: habit.updatedAt,
        clientId: habit.clientId,
        localVersion: habit.localVersion,
      })),
    });
  }

  // Push completions
  if (data.completions.length > 0) {
    await convexHttpClient.mutation(api.sync.pushCompletions, {
      userId,
      completions: data.completions.map((c) => ({
        externalId: c.id,
        habitId: c.habitId,
        completedAt: c.completedAt,
        xpEarned: c.xpEarned,
        clientId: c.clientId,
        localVersion: c.localVersion,
      })),
    });
  }

  // Push badges
  if (data.badges.length > 0) {
    await convexHttpClient.mutation(api.sync.pushBadges, {
      userId,
      badges: data.badges.map((b) => ({
        externalId: b.id,
        badgeType: b.badgeType,
        earnedAt: b.earnedAt,
      })),
    });
  }

  // Mark as synced locally
  for (const habit of data.habits) {
    await syncQueue.markHabitSynced(habit.id);
  }
  for (const completion of data.completions) {
    await syncQueue.markCompletionSynced(completion.id);
  }
  for (const badge of data.badges) {
    await syncQueue.markBadgeSynced(badge.id);
  }

  // Push user profile
  const user = useAuthStore.getState().user;
  if (user) {
    await convexHttpClient.mutation(api.sync.pushUserProfile, {
      userId,
      name: user.name,
      characterName: user.characterName,
      characterClass: user.characterClass,
      xp: user.xp,
      level: user.level,
    });
  }
}

async function pullRemoteChanges(userId: string): Promise<void> {
  const db = await getDatabase();
  const lastSynced = useSyncStore.getState().lastSyncedAt;

  // Pull remote habits
  const remoteHabits = await convexHttpClient.query(api.sync.pullHabits, {
    userId,
    since: lastSynced ?? undefined,
  });

  for (const remote of remoteHabits) {
    const localHabit = await habitRepository.getById(db, remote.externalId);

    if (!localHabit) {
      // New habit from another device — insert locally
      await habitRepository.create(db, {
        id: remote.externalId,
        userId,
        name: remote.name,
        description: remote.description ?? '',
        recurrence: remote.recurrence,
        category: remote.category,
        difficulty: remote.difficulty,
        scheduledTime: remote.scheduledTime ?? undefined,
        clientId: remote.clientId ?? '',
      });
    } else {
      // Conflict resolution
      const remoteHabit: Habit = {
        ...localHabit,
        name: remote.name,
        description: remote.description ?? '',
        recurrence: remote.recurrence,
        category: remote.category,
        difficulty: remote.difficulty,
        archived: remote.archived ?? false,
        updatedAt: remote.updatedAt,
        localVersion: remote.localVersion ?? 1,
      };

      const result = conflictResolver.resolveHabitConflict(localHabit, remoteHabit);

      if (result.winner === 'remote') {
        await habitRepository.update(db, remote.externalId, {
          name: result.resolved.name,
          description: result.resolved.description,
          recurrence: result.resolved.recurrence,
          category: result.resolved.category,
          difficulty: result.resolved.difficulty,
        });
      }
    }
  }

  // Pull remote completions (append-only, no conflicts)
  const remoteCompletions = await convexHttpClient.query(api.sync.pullCompletions, {
    userId,
    since: lastSynced ?? undefined,
  });

  for (const remote of remoteCompletions) {
    const exists = await db.getFirstAsync(
      'SELECT id FROM completions WHERE id = ?',
      [remote.externalId]
    );

    if (!exists) {
      await db.runAsync(
        'INSERT INTO completions (id, habit_id, completed_at, xp_earned, synced, local_version, client_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [
          remote.externalId,
          remote.habitId,
          remote.completedAt,
          remote.xpEarned,
          remote.localVersion ?? 1,
          remote.clientId ?? '',
        ]
      );
    }
  }
}
