import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Habit } from '../../types';
import { HabitCard } from './HabitCard';
import { useHabitStore } from '../../stores/habitStore';
import { useThemeStore } from '../../stores/themeStore';
import { spacing, typography } from '../../constants/theme';

interface HabitListProps {
  habits: Habit[];
  onHabitPress: (habit: Habit) => void;
  onComplete?: (xpEarned: number) => void;
}

export function HabitList({ habits, onHabitPress, onComplete }: HabitListProps) {
  const colors = useThemeStore((s) => s.colors);
  const isCompletedToday = useHabitStore((s) => s.isCompletedToday);
  const [showCompleted, setShowCompleted] = useState(true);

  const incomplete = habits.filter((h) => !isCompletedToday(h.id));
  const completed = habits.filter((h) => isCompletedToday(h.id));

  return (
    <View style={styles.list}>
      {incomplete.map((habit) => (
        <HabitCard
          key={habit.id}
          habit={habit}
          onPress={() => onHabitPress(habit)}
          onComplete={onComplete}
        />
      ))}

      {completed.length > 0 && (
        <View style={styles.completedSection}>
          <TouchableOpacity
            style={styles.completedHeader}
            onPress={() => setShowCompleted(!showCompleted)}
          >
            <Text style={[styles.completedTitle, { color: colors.textSecondary }]}>
              Completed ({completed.length})
            </Text>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>
              {showCompleted ? '\u25B2' : '\u25BC'}
            </Text>
          </TouchableOpacity>

          {showCompleted &&
            completed.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                onPress={() => onHabitPress(habit)}
              />
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: spacing.xxxl,
  },
  completedSection: {
    marginTop: spacing.lg,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  completedTitle: {
    ...typography.caption,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 12,
  },
});
