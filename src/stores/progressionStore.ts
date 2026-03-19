import { create } from 'zustand';
import { Badge, BadgeType } from '../types';
import { getLevelForXp, getXpProgress } from '../services/rpg/levelCalculator';

interface ProgressionState {
  xp: number;
  level: number;
  badges: Badge[];
  showLevelUp: boolean;
  newLevelReached: number;
  recentBadge: Badge | null;
  xpProgress: ReturnType<typeof getXpProgress>;

  setXp: (xp: number) => void;
  addXp: (amount: number) => { leveledUp: boolean; newLevel: number };
  setBadges: (badges: Badge[]) => void;
  addBadge: (badge: Badge) => void;
  dismissLevelUp: () => void;
  dismissBadge: () => void;
  hydrate: (xp: number, level: number, badges: Badge[]) => void;
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  xp: 0,
  level: 1,
  badges: [],
  showLevelUp: false,
  newLevelReached: 0,
  recentBadge: null,
  xpProgress: getXpProgress(0),

  setXp: (xp) => {
    const level = getLevelForXp(xp);
    set({ xp, level, xpProgress: getXpProgress(xp) });
  },

  addXp: (amount) => {
    const state = get();
    const newXp = state.xp + amount;
    const newLevel = getLevelForXp(newXp);
    const leveledUp = newLevel > state.level;

    set({
      xp: newXp,
      level: newLevel,
      xpProgress: getXpProgress(newXp),
      ...(leveledUp ? { showLevelUp: true, newLevelReached: newLevel } : {}),
    });

    return { leveledUp, newLevel };
  },

  setBadges: (badges) => set({ badges }),

  addBadge: (badge) =>
    set((state) => ({
      badges: [...state.badges, badge],
      recentBadge: badge,
    })),

  dismissLevelUp: () => set({ showLevelUp: false }),
  dismissBadge: () => set({ recentBadge: null }),

  hydrate: (xp, level, badges) =>
    set({
      xp,
      level,
      badges,
      xpProgress: getXpProgress(xp),
    }),
}));
