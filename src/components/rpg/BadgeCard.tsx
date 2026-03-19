import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge, BadgeType } from '../../types';
import { useThemeStore } from '../../stores/themeStore';
import { BADGE_DEFINITIONS } from '../../constants/rpg';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface BadgeCardProps {
  badgeType: BadgeType;
  earned?: Badge;
}

const BADGE_EMOJIS: Record<BadgeType, string> = {
  [BadgeType.FirstStep]: '\uD83D\uDC63',
  [BadgeType.Consistent]: '\uD83D\uDD25',
  [BadgeType.Dedicated]: '\uD83D\uDC8E',
  [BadgeType.Collector]: '\uD83C\uDF1F',
  [BadgeType.Overachiever]: '\uD83C\uDFC6',
  [BadgeType.Veteran]: '\u2694\uFE0F',
};

export function BadgeCard({ badgeType, earned }: BadgeCardProps) {
  const colors = useThemeStore((s) => s.colors);
  const definition = BADGE_DEFINITIONS.find((b) => b.type === badgeType);
  const isEarned = !!earned;

  if (!definition) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isEarned ? colors.gold + '10' : colors.surface,
          borderColor: isEarned ? colors.gold : colors.border,
          opacity: isEarned ? 1 : 0.5,
        },
      ]}
    >
      <Text style={[styles.emoji, !isEarned && styles.lockedEmoji]}>
        {isEarned ? BADGE_EMOJIS[badgeType] : '\uD83D\uDD12'}
      </Text>
      <Text style={[styles.name, { color: isEarned ? colors.gold : colors.textMuted }]}>
        {definition.name}
      </Text>
      <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
        {isEarned ? definition.description : definition.hint}
      </Text>
      {isEarned && earned && (
        <Text style={[styles.date, { color: colors.textMuted }]}>
          {new Date(earned.earnedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  lockedEmoji: {
    fontSize: 28,
  },
  name: {
    ...typography.bodyBold,
    textAlign: 'center',
  },
  description: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  date: {
    ...typography.small,
    marginTop: spacing.xs,
  },
});
