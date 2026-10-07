import { create } from 'zustand';

// Feedback from guild actions that should show whichever screen the user is on:
// a toast, a guild level-up celebration, and which tasks are mid-upload.
interface GuildFeedbackState {
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  levelUp: { guildName: string; level: number } | null;
  busyTaskIds: string[];

  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  dismissToast: () => void;
  showLevelUp: (guildName: string, level: number) => void;
  dismissLevelUp: () => void;
  setTaskBusy: (taskId: string, busy: boolean) => void;
  reset: () => void;
}

export const useGuildFeedbackStore = create<GuildFeedbackState>((set) => ({
  toast: null,
  levelUp: null,
  busyTaskIds: [],

  showToast: (message, type = 'success') => set({ toast: { message, type } }),
  dismissToast: () => set({ toast: null }),
  showLevelUp: (guildName, level) => set({ levelUp: { guildName, level } }),
  dismissLevelUp: () => set({ levelUp: null }),
  setTaskBusy: (taskId, busy) =>
    set((state) => ({
      busyTaskIds: busy
        ? [...state.busyTaskIds.filter((id) => id !== taskId), taskId]
        : state.busyTaskIds.filter((id) => id !== taskId),
    })),
  reset: () => set({ toast: null, levelUp: null, busyTaskIds: [] }),
}));
