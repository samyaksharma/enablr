import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useSyncStore } from '../../stores/syncStore';
import { useThemeStore } from '../../stores/themeStore';
import { SyncStatus } from '../../types';
import { spacing, typography } from '../../constants/theme';

export function SyncIndicator() {
  const colors = useThemeStore((s) => s.colors);
  const { status, lastSyncedAt } = useSyncStore();

  const getStatusText = () => {
    switch (status) {
      case SyncStatus.Syncing:
        return 'Syncing...';
      case SyncStatus.Error:
        return 'Sync failed';
      case SyncStatus.Offline:
        return 'Offline';
      case SyncStatus.Idle:
        if (lastSyncedAt) {
          const ago = getTimeAgo(lastSyncedAt);
          return `Last synced ${ago}`;
        }
        return 'Not yet synced';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case SyncStatus.Syncing:
        return colors.primary;
      case SyncStatus.Error:
        return colors.error;
      case SyncStatus.Offline:
        return colors.warning;
      case SyncStatus.Idle:
        return colors.success;
    }
  };

  return (
    <View style={styles.container}>
      {status === SyncStatus.Syncing ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
      )}
      <Text style={[styles.text, { color: colors.textSecondary }]}>{getStatusText()}</Text>
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    ...typography.caption,
  },
});
