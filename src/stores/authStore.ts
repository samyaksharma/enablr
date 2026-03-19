import { create } from 'zustand';
import { User } from '../types';

interface AuthState {
  user: User | null;
  convexUserId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasCharacter: boolean;
  setUser: (user: User) => void;
  setConvexUserId: (uid: string) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  convexUserId: null,
  isAuthenticated: false,
  isLoading: true,
  hasCharacter: false,
  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
      hasCharacter: !!user.characterName,
      isLoading: false,
    }),
  setConvexUserId: (uid) => set({ convexUserId: uid }),
  clearUser: () =>
    set({
      user: null,
      convexUserId: null,
      isAuthenticated: false,
      hasCharacter: false,
      isLoading: false,
    }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
