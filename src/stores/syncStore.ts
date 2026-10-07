import { create } from 'zustand';
import { SyncStatus } from '../types';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: string | null;
  error: string | null;
  isConnected: boolean;
  // True only while the server has confirmed this device's login. Sync waits
  // for it, because the session is re-established each time the app restarts.
  sessionReady: boolean;
  // Server time of the last successful pull; the next pull starts from here
  pullCursor: number | null;
  // A one-line message from sync for the user (e.g. a habit archived elsewhere)
  notice: string | null;

  setSyncing: () => void;
  setSynced: () => void;
  setError: (error: string) => void;
  setConnected: (connected: boolean) => void;
  setIdle: () => void;
  setSessionReady: (ready: boolean) => void;
  setPullCursor: (cursor: number) => void;
  setNotice: (notice: string) => void;
  clearNotice: () => void;
  reset: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: SyncStatus.Idle,
  lastSyncedAt: null,
  error: null,
  isConnected: true,
  sessionReady: false,
  pullCursor: null,
  notice: null,

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
  setSessionReady: (ready) => set({ sessionReady: ready }),
  setPullCursor: (cursor) => set({ pullCursor: cursor }),
  setNotice: (notice) => set({ notice }),
  clearNotice: () => set({ notice: null }),
  reset: () =>
    set({ status: SyncStatus.Idle, lastSyncedAt: null, error: null, pullCursor: null, notice: null }),
}));
