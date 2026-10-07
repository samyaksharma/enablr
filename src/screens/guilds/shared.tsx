import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { useThemeStore } from '../../stores/themeStore';
import { useGuildFeedbackStore } from '../../stores/guildFeedbackStore';
import { errorMessage } from '../../utils/errors';
import { MediaError } from '../../services/media/upload';
import { borderRadius, spacing, typography } from '../../constants/theme';

export type GuildOverview = NonNullable<FunctionReturnType<typeof api.guilds.overview>>;
export type GuildMembership = NonNullable<GuildOverview['membership']>;

// Runs a guild action and reports a failure as a toast with a real message.
// Returns true if it went through.
export async function attempt(action: () => Promise<unknown>, success?: string): Promise<boolean> {
  const feedback = useGuildFeedbackStore.getState();
  try {
    await action();
    if (success) feedback.showToast(success);
    return true;
  } catch (error) {
    feedback.showToast(error instanceof MediaError ? error.message : errorMessage(error), 'error');
    return false;
  }
}

export function Loading() {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={[shared.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

// A row of selectable chips; used for single and multiple choice.
export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { key: T; label: string; color?: string }[];
  selected: T[];
  onToggle: (key: T) => void;
}) {
  const colors = useThemeStore((s) => s.colors);
  return (
    <View style={shared.chipRow}>
      {options.map((option) => {
        const isSelected = selected.includes(option.key);
        const tint = option.color ?? colors.primary;
        return (
          <TouchableOpacity
            key={option.key}
            style={[
              shared.choiceChip,
              {
                backgroundColor: isSelected ? tint + '20' : colors.surface,
                borderColor: isSelected ? tint : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => onToggle(option.key)}
          >
            <Text style={[shared.choiceLabel, { color: isSelected ? tint : colors.text }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  title: {
    ...typography.h1,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.small,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  choiceChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  choiceLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  cardGap: {
    marginBottom: spacing.md,
  },
  body: {
    ...typography.body,
  },
  bodyBold: {
    ...typography.bodyBold,
  },
  caption: {
    ...typography.caption,
  },
  small: {
    ...typography.small,
  },
});
