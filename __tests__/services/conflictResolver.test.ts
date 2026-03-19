import { conflictResolver } from '../../src/services/sync/conflictResolver';
import { Habit, Difficulty, HabitCategory } from '../../src/types';

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    userId: 'user-1',
    name: 'Test Habit',
    description: '',
    recurrence: { type: 'daily' },
    category: HabitCategory.Health,
    difficulty: Difficulty.Medium,
    scheduledTime: undefined,
    archived: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    clientId: 'client-1',
    localVersion: 1,
    synced: false,
    ...overrides,
  };
}

describe('conflictResolver', () => {
  describe('resolveHabitConflict', () => {
    it('local wins when local is newer', () => {
      const local = makeHabit({
        name: 'Local Name',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
      const remote = makeHabit({
        name: 'Remote Name',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });

      const result = conflictResolver.resolveHabitConflict(local, remote);
      expect(result.winner).toBe('local');
      expect(result.resolved.name).toBe('Local Name');
    });

    it('remote wins when remote is newer', () => {
      const local = makeHabit({
        name: 'Local Name',
        updatedAt: '2024-01-01T00:00:00.000Z',
      });
      const remote = makeHabit({
        name: 'Remote Name',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });

      const result = conflictResolver.resolveHabitConflict(local, remote);
      expect(result.winner).toBe('remote');
      expect(result.resolved.name).toBe('Remote Name');
    });

    it('remote wins on tie (server wins ties)', () => {
      const local = makeHabit({
        name: 'Local Name',
        updatedAt: '2024-01-01T12:00:00.000Z',
      });
      const remote = makeHabit({
        name: 'Remote Name',
        updatedAt: '2024-01-01T12:00:00.000Z',
      });

      const result = conflictResolver.resolveHabitConflict(local, remote);
      expect(result.winner).toBe('remote');
    });
  });

  describe('resolveDeletedHabitWithCompletions', () => {
    it('archives and shows toast when habit deleted but has local completions', () => {
      const remoteHabit = makeHabit({ archived: true, name: 'Deleted Habit' });

      const result = conflictResolver.resolveDeletedHabitWithCompletions(remoteHabit, true);
      expect(result.habit.archived).toBe(true);
      expect(result.showToast).toBe(true);
      expect(result.toastMessage).toContain('Deleted Habit');
    });

    it('does not show toast when no local completions', () => {
      const remoteHabit = makeHabit({ archived: true });

      const result = conflictResolver.resolveDeletedHabitWithCompletions(remoteHabit, false);
      expect(result.showToast).toBe(false);
    });
  });
});
