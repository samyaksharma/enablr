import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { parseTime } from '../../services/notifications/localNotifications';
import { borderRadius, spacing, typography } from '../../constants/theme';

const DEFAULT_TIME = '08:00';
const MINUTE_STEP = 5;

interface TimePickerProps {
  label?: string;
  // "HH:mm" in 24-hour time, or an empty string when no time is set
  value: string;
  onChange: (value: string) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');

// A digital clock face: step each half with the arrows, or tap the digits to type.
export function TimePicker({ label, value, onChange }: TimePickerProps) {
  const colors = useThemeStore((s) => s.colors);
  const time = parseTime(value);

  if (!time) {
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          onPress={() => onChange(DEFAULT_TIME)}
          style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[typography.body, { color: colors.textMuted }]}>No time set</Text>
          <Text style={[styles.action, { color: colors.primary }]}>Set a time</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { hour, minute } = time;
  const set = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`);

  const stepMinute = (direction: 1 | -1) => {
    // Land on the next multiple of the step, so 08:02 goes to 08:05 or 08:00
    const next =
      direction === 1
        ? Math.floor(minute / MINUTE_STEP) * MINUTE_STEP + MINUTE_STEP
        : Math.ceil(minute / MINUTE_STEP) * MINUTE_STEP - MINUTE_STEP;
    set(hour, (next + 60) % 60);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={[styles.face, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.clock}>
          <Segment
            name="Hour"
            value={hour}
            max={23}
            onCommit={(h) => set(h, minute)}
            onStep={(direction) => set((hour + direction + 24) % 24, minute)}
          />
          <Text style={[styles.digits, styles.colon, { color: colors.textMuted }]}>:</Text>
          <Segment
            name="Minute"
            value={minute}
            max={59}
            onCommit={(m) => set(hour, m)}
            onStep={stepMinute}
          />
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => onChange('')}
          style={styles.clear}
        >
          <Text style={[styles.action, { color: colors.textMuted }]}>Clear</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface SegmentProps {
  name: string;
  value: number;
  max: number;
  onCommit: (value: number) => void;
  onStep: (direction: 1 | -1) => void;
}

function Segment({ name, value, max, onCommit, onStep }: SegmentProps) {
  const colors = useThemeStore((s) => s.colors);
  // Holds the digits while they are being typed; null when showing the saved value
  const [draft, setDraft] = useState<string | null>(null);

  // Saved on every keystroke, so Save works even while the keyboard is still open
  const type = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 2);
    setDraft(digits);
    if (digits !== '') onCommit(Math.min(Number(digits), max));
  };

  return (
    <View style={styles.segment}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${name} up`}
        hitSlop={8}
        onPress={() => onStep(1)}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: colors.primary }]}>▲</Text>
      </TouchableOpacity>
      <TextInput
        accessibilityLabel={name}
        style={[
          styles.digits,
          styles.digitBox,
          {
            color: colors.text,
            backgroundColor: colors.background,
            borderColor: draft !== null ? colors.primary : colors.border,
          },
        ]}
        value={draft ?? pad(value)}
        onFocus={() => setDraft('')}
        onChangeText={type}
        onBlur={() => setDraft(null)}
        placeholder={pad(value)}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
      />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${name} down`}
        hitSlop={8}
        onPress={() => onStep(-1)}
        style={styles.arrow}
      >
        <Text style={[styles.arrowText, { color: colors.primary }]}>▼</Text>
      </TouchableOpacity>
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
    marginBottom: spacing.xs,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    minHeight: 48,
  },
  action: {
    ...typography.caption,
    fontWeight: '600',
  },
  face: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    alignItems: 'center',
  },
  arrow: {
    minWidth: 48,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    fontSize: 18,
  },
  digits: {
    fontSize: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  digitBox: {
    width: 96,
    paddingVertical: spacing.xs,
    textAlign: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  colon: {
    marginHorizontal: spacing.sm,
  },
  clear: {
    marginTop: spacing.sm,
  },
});
