import { create } from 'zustand';
import { Habit, Completion, Difficulty, HabitCategory, Recurrence } from '../types';
import { getDatabase } from '../db/database';
import { habitRepository, HabitUpdates } from '../db/repositories/habitRepository';
import { completionRepository } from '../db/repositories/completionRepository';
import { badgeRepository } from '../db/repositories/badgeRepository';
import { calculateXp } from '../services/rpg/xpCalculator';
import { evaluateBadges, BadgeContext } from '../services/rpg/badgeEvaluator';
import { getHabitStreak, isScheduledForDate } from '../utils/recurrenceUtils';
import { requestSync } from '../services/sync/syncTrigger';
import { localNotifications } from '../services/notifications/localNotifications';
import { generateId, getClientId } from '../utils/idGenerator';
import { useProgressionStore } from './progressionStore';
import { useAuthStore } from './authStore';
import { userRepository } from '../db/repositories/userRepository';

interface HabitState {
  habits: Habit[];
  completions: Map<string, Completion[]>; // habitId -> completions
  todaysHabits: Habit[];
  todaysCompletedHabitIds: Set<string>;
  isLoading: boolean;

  loadHabits: () => Promise<void>;
  createHabit: (params: {
    name: string;
    description?: string;
    recurrence: Recurrence;
    category: HabitCategory;
    difficulty: Difficulty;
    scheduledTime?: string;
    reminderEnabled?: boolean;
  }) => Promise<Habit>;
  updateHabit: (habitId: string, updates: HabitUpdates) => Promise<void>;
  archiveHabit: (habitId: string) => Promise<void>;
  completeHabit: (habitId: string) => Promise<{ xpEarned: number }>;
  isCompletedToday: (habitId: string) => boolean;
  reset: () => void;
}

function filterTodaysHabits(habits: Habit[]): Habit[] {
  const today = new Date();
  return habits.filter((h) => !h.archived && isScheduledForDate(h.recurrence, today, h.createdAt));
}

function sortTodaysHabits(habits: Habit[], completedIds: Set<string>): Habit[] {
  return [...habits].sort((a, b) => {
    const aCompleted = completedIds.has(a.id);
    const bCompleted = completedIds.has(b.id);
    if (aCompleted !== bCompleted) return aCompleted ? 1 : -1;
    if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime);
    if (a.scheduledTime) return -1;
    if (b.scheduledTime) return 1;
    return a.name.localeCompare(b.name);
  });
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  completions: new Map(),
  todaysHabits: [],
  todaysCompletedHabitIds: new Set(),
  isLoading: false,

  loadHabits: async () => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    set({ isLoading: true });
    const db = await getDatabase();
    const habits = await habitRepository.getActiveByUserId(db, userId);

    // Load today's completions for each habit
    const completionsMap = new Map<string, Completion[]>();
    const completedIds = new Set<string>();

    for (const habit of habits) {
      const todayCompletion = await completionRepository.getTodayByHabitId(db, habit.id);
      if (todayCompletion) {
        completedIds.add(habit.id);
      }
      const allCompletions = await completionRepository.getByHabitId(db, habit.id);
      completionsMap.set(habit.id, allCompletions);
    }

    const todays = filterTodaysHabits(habits);
    const sorted = sortTodaysHabits(todays, completedIds);

    set({
      habits,
      completions: completionsMap,
      todaysHabits: sorted,
      todaysCompletedHabitIds: completedIds,
      isLoading: false,
    });
    localNotifications.syncReminders(habits);
  },

  createHabit: async (params) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Not authenticated');

    const db = await getDatabase();
    const clientId = await getClientId();

    const habit = await habitRepository.create(db, {
      id: generateId(),
      userId,
      name: params.name,
      description: params.description ?? '',
      recurrence: params.recurrence,
      category: params.category,
      difficulty: params.difficulty,
      scheduledTime: params.scheduledTime,
      reminderEnabled: params.reminderEnabled,
      clientId,
    });

    const state = get();
    const newHabits = [...state.habits, habit];
    const todays = filterTodaysHabits(newHabits);
    const sorted = sortTodaysHabits(todays, state.todaysCompletedHabitIds);

    set({ habits: newHabits, todaysHabits: sorted });
    localNotifications.syncReminders(newHabits);

    // Check collector badge
    await checkBadgesAfterAction(db, userId, newHabits, state.todaysCompletedHabitIds, todays);
    requestSync();

    return habit;
  },

  updateHabit: async (habitId, updates) => {
    const db = await getDatabase();
    await habitRepository.update(db, habitId, updates);

    const updated = await habitRepository.getById(db, habitId);
    if (!updated) return;

    const state = get();
    const newHabits = state.habits.map((h) => (h.id === habitId ? updated : h));
    const todays = filterTodaysHabits(newHabits);
    const sorted = sortTodaysHabits(todays, state.todaysCompletedHabitIds);

    set({ habits: newHabits, todaysHabits: sorted });
    localNotifications.syncReminders(newHabits);
    requestSync();
  },

  archiveHabit: async (habitId) => {
    const db = await getDatabase();
    await habitRepository.archive(db, habitId);

    const state = get();
    const newHabits = state.habits.filter((h) => h.id !== habitId);
    const todays = filterTodaysHabits(newHabits);
    const sorted = sortTodaysHabits(todays, state.todaysCompletedHabitIds);

    set({ habits: newHabits, todaysHabits: sorted });
    localNotifications.syncReminders(newHabits);
    requestSync();
  },

  completeHabit: async (habitId) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) throw new Error('Not authenticated');

    const db = await getDatabase();
    const habit = await habitRepository.getById(db, habitId);
    if (!habit) throw new Error('Habit not found');

    // A second tap, or a completion synced from another device, must not pay twice
    if (await completionRepository.getTodayByHabitId(db, habitId)) {
      return { xpEarned: 0 };
    }

    // Calculate streak, counting today's completion
    const completionDates = await completionRepository.getCompletionDatesForHabit(db, habitId);
    const streakDays = getHabitStreak([...completionDates, new Date().toISOString()], habit);

    const xpEarned = calculateXp(habit.difficulty, streakDays);

    // Write completion
    const clientId = await getClientId();
    const completion = await completionRepository.create(db, {
      id: generateId(),
      habitId,
      xpEarned,
      clientId,
    });

    // Update XP
    const progressionStore = useProgressionStore.getState();
    const { leveledUp, newLevel } = progressionStore.addXp(xpEarned);

    // Persist XP to SQLite
    const newXp = useProgressionStore.getState().xp;
    await userRepository.updateXpAndLevel(db, userId, newXp, newLevel || progressionStore.level);

    // Update local state
    const state = get();
    const newCompletions = new Map(state.completions);
    const habitCompletions = newCompletions.get(habitId) ?? [];
    newCompletions.set(habitId, [completion, ...habitCompletions]);

    const newCompletedIds = new Set(state.todaysCompletedHabitIds);
    newCompletedIds.add(habitId);

    const sorted = sortTodaysHabits(state.todaysHabits, newCompletedIds);

    set({
      completions: newCompletions,
      todaysCompletedHabitIds: newCompletedIds,
      todaysHabits: sorted,
    });

    // Evaluate badges
    const todays = filterTodaysHabits(state.habits);
    await checkBadgesAfterAction(db, userId, state.habits, newCompletedIds, todays);
    requestSync();

    return { xpEarned };
  },

  isCompletedToday: (habitId) => {
    return get().todaysCompletedHabitIds.has(habitId);
  },

  reset: () =>
    set({
      habits: [],
      completions: new Map(),
      todaysHabits: [],
      todaysCompletedHabitIds: new Set(),
      isLoading: false,
    }),
}));

async function checkBadgesAfterAction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  userId: string,
  habits: Habit[],
  completedIds: Set<string>,
  todaysHabits: Habit[]
) {
  const progressionStore = useProgressionStore.getState();
  const earnedBadges = new Set(progressionStore.badges.map((b) => b.badgeType));
  const totalCompletions = await completionRepository.getTotalCount(db, userId);

  // Build streak map
  const habitStreaks = new Map<string, number>();
  for (const habit of habits) {
    const dates = await completionRepository.getCompletionDatesForHabit(db, habit.id);
    habitStreaks.set(habit.id, getHabitStreak(dates, habit));
  }

  const allTodayCompleted = todaysHabits.length > 0 && todaysHabits.every((h) => completedIds.has(h.id));

  const context: BadgeContext = {
    totalCompletions,
    habitStreaks,
    activeHabitCount: habits.filter((h) => !h.archived).length,
    allTodayHabitsCompleted: allTodayCompleted,
    todayHabitCount: todaysHabits.length,
    currentLevel: progressionStore.level,
    earnedBadges,
  };

  const newBadges = evaluateBadges(context);
  const clientId = await getClientId();

  for (const badgeType of newBadges) {
    const badge = await badgeRepository.create(db, {
      id: generateId(),
      userId,
      badgeType,
    });
    progressionStore.addBadge(badge);
  }
}
