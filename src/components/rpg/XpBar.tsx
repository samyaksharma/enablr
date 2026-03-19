import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { useProgressionStore } from '../../stores/progressionStore';
import { useThemeStore } from '../../stores/themeStore';
import { spacing, typography } from '../../constants/theme';

interface XpBarProps {
  compact?: boolean;
}

export function XpBar({ compact = false }: XpBarProps) {
  const colors = useThemeStore((s) => s.colors);
  const { level, xpProgress } = useProgressionStore();

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={[styles.compactLevel, { color: colors.gold }]}>Lv {level}</Text>
        <ProgressBar progress={xpProgress.progress} height={6} style={{ width: 80 }} />
      </View>
    );
  }

  return (
    <View style={styles.full}>
      <View style={styles.fullHeader}>
        <Text style={[styles.levelText, { color: colors.gold }]}>Level {level}</Text>
        <Text style={[styles.xpText, { color: colors.textSecondary }]}>
          {xpProgress.xpIntoLevel} / {xpProgress.nextLevelXp - xpProgress.currentLevelXp} XP
        </Text>
      </View>
      <ProgressBar progress={xpProgress.progress} height={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  compactLevel: {
    ...typography.small,
    fontWeight: '700',
  },
  full: {
    width: '100%',
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  levelText: {
    ...typography.bodyBold,
  },
  xpText: {
    ...typography.caption,
  },
});
