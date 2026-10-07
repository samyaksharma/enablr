import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { TimePicker } from '../../components/ui/TimePicker';
import { DifficultyPicker } from '../../components/habits/DifficultyPicker';
import { useHabitStore } from '../../stores/habitStore';
import { useThemeStore } from '../../stores/themeStore';
import { Difficulty, HabitCategory, Recurrence, RecurrenceType } from '../../types';
import { CATEGORY_CONFIG } from '../../constants/categories';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { HomeStackParamList } from '../../navigation/MainTabs';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function EditHabitScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<HomeStackParamList, 'EditHabit'>>();
  const colors = useThemeStore((s) => s.colors);
  const habits = useHabitStore((s) => s.habits);
  const updateHabit = useHabitStore((s) => s.updateHabit);
  const archiveHabit = useHabitStore((s) => s.archiveHabit);

  const habit = habits.find((h) => h.id === route.params.habitId);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [category, setCategory] = useState<HabitCategory>(HabitCategory.Health);
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [scheduledTime, setScheduledTime] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setDifficulty(habit.difficulty);
      setCategory(habit.category);
      setRecurrenceType(habit.recurrence.type);
      setSelectedDays(habit.recurrence.days ?? []);
      setIntervalDays(String(habit.recurrence.every ?? 2));
      setScheduledTime(habit.scheduledTime ?? '');
      setReminderEnabled(habit.reminderEnabled);
    }
  }, [habit?.id]);

  if (!habit) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text, textAlign: 'center', marginTop: spacing.xxxl }}>
          Habit not found
        </Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a habit name');
      return;
    }
    if (recurrenceType === 'specific_days' && selectedDays.length === 0) {
      Alert.alert('Required', 'Pick at least one day for this habit');
      return;
    }
    const time = scheduledTime || undefined;

    setLoading(true);

    const recurrence: Recurrence = {
      type: recurrenceType,
      ...(recurrenceType === 'specific_days' && { days: selectedDays }),
      ...(recurrenceType === 'interval' && { every: parseInt(intervalDays, 10) || 2 }),
    };

    try {
      await updateHabit(habit.id, {
        name: name.trim(),
        description: description.trim(),
        recurrence,
        category,
        difficulty,
        scheduledTime: time ?? null,
        reminderEnabled,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to update habit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = () => {
    Alert.alert(
      'Archive Habit',
      'This habit will be removed from your active list. Your history and streaks will be preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            await archiveHabit(habit.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Input label="Habit Name" value={name} onChangeText={setName} />

      <Input
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <DifficultyPicker value={difficulty} onChange={setDifficulty} />

      <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
      <View style={styles.categoryGrid}>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const isSelected = category === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected ? config.color + '20' : colors.surface,
                  borderColor: isSelected ? config.color : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setCategory(key as HabitCategory)}
            >
              <Text style={[styles.categoryLabel, { color: isSelected ? config.color : colors.text }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Recurrence</Text>
      <View style={styles.recurrenceOptions}>
        {(['daily', 'specific_days', 'interval'] as RecurrenceType[]).map((type) => {
          const labels: Record<RecurrenceType, string> = {
            daily: 'Daily',
            specific_days: 'Specific Days',
            interval: 'Every X Days',
          };
          const isSelected = recurrenceType === type;
          return (
            <TouchableOpacity
              key={type}
              style={[
                styles.recurrenceChip,
                {
                  backgroundColor: isSelected ? colors.primary + '20' : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setRecurrenceType(type)}
            >
              <Text style={[styles.recurrenceLabel, { color: isSelected ? colors.primary : colors.text }]}>
                {labels[type]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {recurrenceType === 'specific_days' && (
        <View style={styles.daysRow}>
          {DAYS.map((day, index) => {
            const isSelected = selectedDays.includes(index);
            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => toggleDay(index)}
              >
                <Text style={[styles.dayLabel, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {recurrenceType === 'interval' && (
        <Input
          label="Every how many days?"
          value={intervalDays}
          onChangeText={setIntervalDays}
          keyboardType="number-pad"
        />
      )}

      <TimePicker
        label="Scheduled Time (optional)"
        value={scheduledTime}
        onChange={setScheduledTime}
      />

      {scheduledTime !== '' && (
        <View style={styles.reminderRow}>
          <Text style={[styles.reminderLabel, { color: colors.text }]}>Remind me at this time</Text>
          <Switch
            value={reminderEnabled}
            onValueChange={setReminderEnabled}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      )}

      <Button title="Save Changes" onPress={handleSave} loading={loading} size="lg" style={{ marginTop: spacing.lg }} />

      <Button
        title="Archive Habit"
        onPress={handleArchive}
        variant="ghost"
        style={{ marginTop: spacing.md }}
        textStyle={{ color: colors.error }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  reminderLabel: {
    ...typography.body,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  categoryLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  recurrenceOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  recurrenceChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  recurrenceLabel: {
    ...typography.small,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayLabel: {
    ...typography.small,
    fontWeight: '600',
  },
});
