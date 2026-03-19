import { create } from 'zustand';
import { colors, ThemeColors } from '../constants/theme';

type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'dark',
  colors: colors.dark,
  toggleTheme: () =>
    set((state) => {
      const newMode = state.mode === 'dark' ? 'light' : 'dark';
      return { mode: newMode, colors: colors[newMode] };
    }),
  setMode: (mode) => set({ mode, colors: colors[mode] }),
}));
