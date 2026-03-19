import { Habit } from '../../types';

export interface ConflictResult {
  winner: 'local' | 'remote';
  resolved: Habit;
  message?: string;
}

export const conflictResolver = {
  resolveHabitConflict(local: Habit, remote: Habit): ConflictResult {
    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    // Last-write-wins, server wins ties
    if (localTime > remoteTime) {
      return { winner: 'local', resolved: local };
    }
    return { winner: 'remote', resolved: remote };
  },

  resolveDeletedHabitWithCompletions(
    remoteHabit: Habit,
    hasLocalCompletions: boolean
  ): { habit: Habit; showToast: boolean; toastMessage: string } {
    if (remoteHabit.archived && hasLocalCompletions) {
      return {
        habit: { ...remoteHabit, archived: true },
        showToast: true,
        toastMessage: `"${remoteHabit.name}" was archived on another device. Your completions have been preserved.`,
      };
    }

    return {
      habit: remoteHabit,
      showToast: false,
      toastMessage: '',
    };
  },
};
