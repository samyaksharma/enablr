import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Difficulty } from '../../types';
import { useThemeStore } from '../../stores/themeStore';
import { BASE_XP } from '../../constants/rpg';
import { spacing, typography, borderRadius } from '../../constants/theme';

interface DifficultyPickerProps {
  value: Difficulty;
  onChange: (difficulty: Difficulty) => void;
}

const DIFFICULTIES = [
  { type: Difficulty.Easy, label: 'Easy', color: '#4CAF50' },
  { type: Difficulty.Medium, label: 'Medium', color: '#FF9800' },
  { type: Difficulty.Hard, label: 'Hard', color: '#F44336' },
];

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  const colors = useThemeStore((s) => s.colors);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Difficulty</Text>
      <View style={styles.options}>
        {DIFFICULTIES.map((d) => {
          const isSelected = value === d.type;
          return (
            <TouchableOpacity
              key={d.type}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? d.color + '20' : colors.surface,
                  borderColor: isSelected ? d.color : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => onChange(d.type)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionLabel, { color: isSelected ? d.color : colors.text }]}>
                {d.label}
              </Text>
              <Text style={[styles.xpLabel, { color: colors.textMuted }]}>
                {BASE_XP[d.type]} XP
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  optionLabel: {
    ...typography.bodyBold,
  },
  xpLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
});
