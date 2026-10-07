import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Habit } from '../../types';
import { Card } from '../ui/Card';
import { useThemeStore } from '../../stores/themeStore';
import { useHabitStore } from '../../stores/habitStore';
import { CATEGORY_CONFIG } from '../../constants/categories';
import { BASE_XP } from '../../constants/rpg';
import { getHabitStreak } from '../../utils/recurrenceUtils';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface HabitCardProps {
  habit: Habit;
  onPress?: () => void;
  onComplete?: (xpEarned: number) => void;
}

const EMPTY_COMPLETIONS: import('../../types').Completion[] = [];

export function HabitCard({ habit, onPress, onComplete }: HabitCardProps) {
  const colors = useThemeStore((s) => s.colors);
  const isCompleted = useHabitStore((s) => s.isCompletedToday(habit.id));
  const completions = useHabitStore((s) => s.completions.get(habit.id)) ?? EMPTY_COMPLETIONS;
  const completeHabit = useHabitStore((s) => s.completeHabit);

  const scale = useSharedValue(1);
  const streak = getHabitStreak(
    completions.map((c) => c.completedAt),
    habit
  );
  const categoryConfig = CATEGORY_CONFIG[habit.category];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleComplete = async () => {
    if (isCompleted) return;

    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withTiming(1.05, { duration: 150 }),
      withTiming(1, { duration: 100 })
    );

    try {
      const { xpEarned } = await completeHabit(habit.id);
      if (xpEarned > 0) onComplete?.(xpEarned);
    } catch {
      // Error handled by store
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Card
          style={[
            styles.card,
            isCompleted && { opacity: 0.7 },
          ]}
        >
          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.checkbox,
                {
                  borderColor: isCompleted ? colors.success : colors.border,
                  backgroundColor: isCompleted ? colors.success : 'transparent',
                },
              ]}
              onPress={handleComplete}
              disabled={isCompleted}
              activeOpacity={0.7}
            >
              {isCompleted && <Text style={styles.checkmark}>{'\u2713'}</Text>}
            </TouchableOpacity>

            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text
                  style={[
                    styles.name,
                    { color: colors.text },
                    isCompleted && styles.completedName,
                  ]}
                  numberOfLines={1}
                >
                  {habit.name}
                </Text>
                {streak > 0 && (
                  <View style={[styles.streakBadge, { backgroundColor: colors.gold + '20' }]}>
                    <Text style={[styles.streakText, { color: colors.gold }]}>
                      {'\uD83D\uDD25'} {streak}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.metaRow}>
                <View
                  style={[styles.categoryBadge, { backgroundColor: categoryConfig.color + '20' }]}
                >
                  <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                    {categoryConfig.label}
                  </Text>
                </View>
                <Text style={[styles.xpText, { color: colors.textMuted }]}>
                  {BASE_XP[habit.difficulty]} XP
                </Text>
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.bodyBold,
    flex: 1,
  },
  completedName: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  streakBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  streakText: {
    ...typography.small,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  categoryText: {
    ...typography.small,
    fontWeight: '600',
  },
  xpText: {
    ...typography.small,
  },
});
