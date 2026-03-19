import { create } from 'zustand';
import { SyncStatus } from '../types';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  isConnected: boolean;

  setSyncing: () => void;
  setSynced: () => void;
  setError: (error: string) => void;
  setConnected: (connected: boolean) => void;
  setIdle: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: SyncStatus.Idle,
  lastSyncedAt: null,
  error: null,
  isConnected: true,

  setSyncing: () => set({ status: SyncStatus.Syncing, error: null }),
  setSynced: () =>
    set({
      status: SyncStatus.Idle,
      lastSyncedAt: new Date().toISOString(),
      error: null,
    }),
  setError: (error) => set({ status: SyncStatus.Error, error }),
  setConnected: (connected) =>
    set({
      isConnected: connected,
      status: connected ? SyncStatus.Idle : SyncStatus.Offline,
    }),
  setIdle: () => set({ status: SyncStatus.Idle }),
}));
