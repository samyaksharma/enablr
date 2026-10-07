import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Habit } from '../../types';
import { HabitCard } from './HabitCard';
import { useHabitStore } from '../../stores/habitStore';
import { useThemeStore } from '../../stores/themeStore';
import { spacing, typography } from '../../constants/theme';
import { formatNextScheduled, getNextScheduledDate } from '../../utils/recurrenceUtils';
import { Card } from '../ui/Card';

interface HabitListProps {
  habits: Habit[];
  upcoming?: Habit[]; // active habits that aren't due today
  onHabitPress: (habit: Habit) => void;
  onComplete?: (xpEarned: number) => void;
}

export function HabitList({ habits, upcoming = [], onHabitPress, onComplete }: HabitListProps) {
  const colors = useThemeStore((s) => s.colors);
  const isCompletedToday = useHabitStore((s) => s.isCompletedToday);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(true);

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

      {upcoming.length > 0 && (
        <View style={styles.completedSection}>
          <TouchableOpacity
            style={styles.completedHeader}
            onPress={() => setShowUpcoming(!showUpcoming)}
          >
            <Text style={[styles.completedTitle, { color: colors.textSecondary }]}>
              Not due today ({upcoming.length})
            </Text>
            <Text style={[styles.chevron, { color: colors.textMuted }]}>
              {showUpcoming ? '\u25B2' : '\u25BC'}
            </Text>
          </TouchableOpacity>

          {showUpcoming &&
            upcoming.map((habit) => (
              <TouchableOpacity
                key={habit.id}
                onPress={() => onHabitPress(habit)}
                activeOpacity={0.8}
              >
                <Card style={styles.upcomingCard}>
                  <Text style={[styles.upcomingName, { color: colors.text }]} numberOfLines={1}>
                    {habit.name}
                  </Text>
                  <Text style={[styles.upcomingNext, { color: colors.textMuted }]}>
                    {formatNextScheduled(getNextScheduledDate(habit.recurrence, habit.createdAt))}
                  </Text>
                </Card>
              </TouchableOpacity>
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
  upcomingCard: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    opacity: 0.7,
  },
  upcomingName: {
    ...typography.bodyBold,
    flex: 1,
    marginRight: spacing.md,
  },
  upcomingNext: {
    ...typography.caption,
  },
});
