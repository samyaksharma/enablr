import { AppState, NativeEventSubscription } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useSyncStore } from '../../stores/syncStore';
import { syncService } from '../sync/syncService';

let unsubscribe: (() => void) | null = null;
let appStateSubscription: NativeEventSubscription | null = null;

export const connectivityMonitor = {
  start() {
    if (unsubscribe) return;

    unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = useSyncStore.getState().isConnected;
      const isConnected = state.isConnected ?? false;

      useSyncStore.getState().setConnected(isConnected);

      // Trigger sync on reconnect
      if (!wasConnected && isConnected) {
        syncService.runSync();
      }
    });

    // Sync whenever the app comes back to the foreground
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncService.runSync();
      }
    });
  },

  stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    appStateSubscription?.remove();
    appStateSubscription = null;
  },

  startPeriodicSync(intervalMs = 15 * 60 * 1000) {
    const timer = setInterval(() => {
      if (useSyncStore.getState().isConnected) {
        syncService.runSync();
      }
    }, intervalMs);

    return () => clearInterval(timer);
  },
};
