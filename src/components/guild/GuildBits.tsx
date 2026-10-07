import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProgressBar } from '../ui/ProgressBar';
import { useThemeStore } from '../../stores/themeStore';
import { getXpProgress } from '../../services/rpg/levelCalculator';
import { ROLE_COLORS } from '../../../convex/permissions';
import { borderRadius, spacing, typography } from '../../constants/theme';

// The guild's uploaded emblem, or a generated one from its initials.
export function GuildEmblem({
  url,
  name,
  size = 48,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  const radius = size * 0.28;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: radius }}
        accessibilityLabel={`${name} emblem`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const color = ROLE_COLORS[hash % ROLE_COLORS.length];
  return (
    <View
      style={[
        styles.generated,
        { width: size, height: size, borderRadius: radius, backgroundColor: color + '30', borderColor: color },
      ]}
    >
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.36 }}>{initials || '?'}</Text>
    </View>
  );
}

export function RoleChip({
  name,
  color,
  iconUrl,
}: {
  name: string;
  color: string;
  iconUrl?: string | null;
}) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '20', borderColor: color }]}>
      {iconUrl ? <Image source={{ uri: iconUrl }} style={styles.chipIcon} /> : null}
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

// Level and XP bar for one guild membership.
export function GuildLevelBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const colors = useThemeStore((s) => s.colors);
  const progress = getXpProgress(xp);
  return (
    <View>
      <View style={styles.levelHeader}>
        <Text style={[compact ? styles.levelSmall : styles.level, { color: colors.gold }]}>
          Guild Level {progress.level}
        </Text>
        <Text style={[styles.levelXp, { color: colors.textSecondary }]}>
          {progress.xpIntoLevel} / {progress.nextLevelXp - progress.currentLevelXp} XP
        </Text>
      </View>
      <ProgressBar progress={progress.progress} height={compact ? 6 : 10} color={colors.accent} />
    </View>
  );
}

export function Tag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: color + '20' }]}>
      <Text style={[styles.tagText, { color }]}>{label}</Text>
    </View>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
      {tabs.map((tab) => {
        const selected = tab.key === value;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, selected && { borderBottomColor: colors.primary }]}
            onPress={() => onChange(tab.key)}
          >
            <Text
              style={[styles.tabLabel, { color: selected ? colors.primary : colors.textSecondary }]}
            >
              {tab.label}
            </Text>
            {tab.badge ? (
              <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Friendly placeholder for an empty list or a screen that can't load.
export function EmptyNote({ title, body }: { title: string; body?: string }) {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  generated: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    maxWidth: 160,
  },
  chipIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: spacing.xs,
  },
  chipText: {
    ...typography.small,
    fontWeight: '700',
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  level: {
    ...typography.bodyBold,
  },
  levelSmall: {
    ...typography.small,
    fontWeight: '700',
  },
  levelXp: {
    ...typography.small,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  tagText: {
    ...typography.small,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginRight: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    ...typography.caption,
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
