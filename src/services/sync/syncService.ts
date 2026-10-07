import { convex } from '../convex/convexClient';
import { api } from '../../../convex/_generated/api';
import { getDatabase } from '../../db/database';
import { habitRepository } from '../../db/repositories/habitRepository';
import { completionRepository } from '../../db/repositories/completionRepository';
import { badgeRepository } from '../../db/repositories/badgeRepository';
import { userRepository } from '../../db/repositories/userRepository';
import { useSyncStore } from '../../stores/syncStore';
import { useAuthStore } from '../../stores/authStore';
import { useHabitStore } from '../../stores/habitStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { getLevelForXp } from '../rpg/levelCalculator';
import { syncQueue } from './syncQueue';
import { conflictResolver } from './conflictResolver';
import { setSyncHandler } from './syncTrigger';
import { BadgeType, Difficulty, Habit, HabitCategory } from '../../types';

let isSyncing = false;
let syncAgain = false;

export const syncService = {
  async runSync(): Promise<void> {
    // A change made mid-sync is picked up by one more pass afterwards
    if (isSyncing) {
      syncAgain = true;
      return;
    }

    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    if (!useSyncStore.getState().isConnected) return;
    if (!useSyncStore.getState().sessionReady) return;

    isSyncing = true;
    useSyncStore.getState().setSyncing();

    try {
      await pushUnsyncedData(userId);
      await pullRemoteChanges(userId);

      // The account may have changed while the requests were in flight
      if (useAuthStore.getState().user?.id !== userId) return;

      useSyncStore.getState().setSynced();
      await useHabitStore.getState().loadHabits();
    } catch {
      useSyncStore
        .getState()
        .setError("Couldn't reach the server. Your changes are safe and will sync later.");
    } finally {
      isSyncing = false;
      if (syncAgain) {
        syncAgain = false;
        syncService.runSync();
      }
    }
  },
};

setSyncHandler(() => {
  syncService.runSync();
});

async function pushUnsyncedData(userId: string): Promise<void> {
  const data = await syncQueue.getUnsyncedData();

  if (data.habits.length > 0) {
    await convex.mutation(api.sync.pushHabits, {
      habits: data.habits.map((habit) => ({
        externalId: habit.id,
        name: habit.name,
        description: habit.description,
        recurrence: habit.recurrence,
        category: habit.category,
        difficulty: habit.difficulty,
        scheduledTime: habit.scheduledTime ?? undefined,
        reminderEnabled: habit.reminderEnabled,
        archived: habit.archived,
        createdAt: habit.createdAt,
        updatedAt: habit.updatedAt,
        clientId: habit.clientId,
        localVersion: habit.localVersion,
      })),
    });
  }

  if (data.completions.length > 0) {
    await convex.mutation(api.sync.pushCompletions, {
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

  if (data.badges.length > 0) {
    await convex.mutation(api.sync.pushBadges, {
      badges: data.badges.map((b) => ({
        externalId: b.id,
        badgeType: b.badgeType,
        earnedAt: b.earnedAt,
      })),
    });
  }

  for (const habit of data.habits) {
    await syncQueue.markHabitSynced(habit.id, habit.localVersion);
  }
  for (const completion of data.completions) {
    await syncQueue.markCompletionSynced(completion.id);
  }
  for (const badge of data.badges) {
    await syncQueue.markBadgeSynced(badge.id);
  }

  const user = useAuthStore.getState().user;
  if (user && user.id === userId) {
    await convex.mutation(api.sync.pushUserProfile, {
      name: user.name,
      characterName: user.characterName,
      characterClass: user.characterClass,
      xp: useProgressionStore.getState().xp,
      level: useProgressionStore.getState().level,
      utcOffsetMinutes: -new Date().getTimezoneOffset(),
    });
  }
}

async function pullRemoteChanges(userId: string): Promise<void> {
  const db = await getDatabase();
  const since = useSyncStore.getState().pullCursor ?? undefined;
  const isFirstPull = since === undefined;

  // Read the server clock before pulling so nothing written during the pull is
  // missed next time. Re-applying a row is harmless, so overlap a little.
  const serverNow = await convex.mutation(api.sync.serverTime, {});

  const remoteHabits = await convex.query(api.sync.pullHabits, { since });
  for (const remote of remoteHabits) {
    const local = await habitRepository.getById(db, remote.externalId);
    if (local && local.userId !== userId) continue;

    const incoming: Omit<Habit, 'synced'> = {
      id: remote.externalId,
      userId,
      name: remote.name,
      description: remote.description ?? '',
      recurrence: remote.recurrence,
      category: remote.category as HabitCategory,
      difficulty: remote.difficulty as Difficulty,
      scheduledTime: remote.scheduledTime ?? undefined,
      reminderEnabled: remote.reminderEnabled ?? true,
      archived: remote.archived,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      clientId: remote.clientId ?? '',
      localVersion: remote.localVersion ?? 1,
    };

    if (local) {
      const { winner } = conflictResolver.resolveHabitConflict(local, { ...incoming, synced: true });
      // A newer local edit stays as it is and goes up on the next push
      if (winner === 'local') continue;

      if (incoming.archived && !local.archived) {
        const completions = await completionRepository.getByHabitId(db, local.id);
        const { showToast, toastMessage } = conflictResolver.resolveDeletedHabitWithCompletions(
          { ...incoming, synced: true },
          completions.length > 0
        );
        if (showToast) useSyncStore.getState().setNotice(toastMessage);
      }
    }
    await habitRepository.upsertFromRemote(db, incoming);
  }

  // Completions are append-only, so there is nothing to resolve
  const remoteCompletions = await convex.query(api.sync.pullCompletions, { since });
  for (const remote of remoteCompletions) {
    await completionRepository.insertFromRemote(db, {
      id: remote.externalId,
      habitId: remote.habitId,
      completedAt: remote.completedAt,
      xpEarned: remote.xpEarned,
      localVersion: remote.localVersion ?? 1,
      clientId: remote.clientId ?? '',
    });
  }

  // Badges earned on another device, or granted by the server for guild events
  const remoteBadges = await convex.query(api.sync.pullBadges, {});
  const ownedTypes = new Set((await badgeRepository.getByUserId(db, userId)).map((b) => b.badgeType));
  for (const remote of remoteBadges) {
    const badgeType = remote.badgeType as BadgeType;
    if (ownedTypes.has(badgeType)) continue;
    ownedTypes.add(badgeType);
    const badge = await badgeRepository.insertFromRemote(db, {
      id: remote.externalId,
      userId,
      badgeType,
      earnedAt: remote.earnedAt,
    });
    if (useAuthStore.getState().user?.id !== userId) continue;
    if (isFirstPull) {
      // Restoring old badges on a fresh device shouldn't look like new unlocks
      const progression = useProgressionStore.getState();
      progression.setBadges([...progression.badges, badge]);
    } else {
      useProgressionStore.getState().addBadge(badge);
    }
  }

  // XP earned on another device. It only ever goes up, so take the higher total.
  const account = await convex.query(api.users.currentUser, {});
  const remoteXp = account?.xp ?? 0;
  if (useAuthStore.getState().user?.id === userId && remoteXp > useProgressionStore.getState().xp) {
    await userRepository.updateXpAndLevel(db, userId, remoteXp, getLevelForXp(remoteXp));
    useProgressionStore.getState().setXp(remoteXp);
  }

  useSyncStore.getState().setPullCursor(serverNow - 5000);
}
