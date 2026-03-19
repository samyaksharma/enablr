export enum SyncStatus {
  Idle = 'idle',
  Syncing = 'syncing',
  Error = 'error',
  Offline = 'offline',
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
}
