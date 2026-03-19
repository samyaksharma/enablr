import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { BadgeCard } from '../../components/rpg/BadgeCard';
import { useProgressionStore } from '../../stores/progressionStore';
import { useThemeStore } from '../../stores/themeStore';
import { BadgeType } from '../../types';
import { BADGE_DEFINITIONS } from '../../constants/rpg';
import { spacing, typography } from '../../constants/theme';

export function BadgesScreen() {
  const colors = useThemeStore((s) => s.colors);
  const badges = useProgressionStore((s) => s.badges);

  const earnedMap = new Map(badges.map((b) => [b.badgeType, b]));
  const earnedCount = badges.length;
  const totalCount = BADGE_DEFINITIONS.length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Badges</Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {earnedCount} / {totalCount} collected
        </Text>
      </View>

      <View style={styles.grid}>
        {BADGE_DEFINITIONS.map((def) => (
          <View key={def.type} style={styles.gridItem}>
            <BadgeCard badgeType={def.type} earned={earnedMap.get(def.type)} />
          </View>
        ))}
      </View>

      {earnedCount === 0 && (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Complete habits to unlock badges and prove your dedication!
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.lg,
  },
  title: {
    ...typography.h1,
  },
  count: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  gridItem: {
    width: '47%',
  },
  emptyState: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
