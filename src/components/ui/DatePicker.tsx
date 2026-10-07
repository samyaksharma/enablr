import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { addDays, addMonths, addYears, format, isValid, parse, startOfDay } from 'date-fns';
import { useThemeStore } from '../../stores/themeStore';
import { borderRadius, spacing, typography } from '../../constants/theme';

const FORMAT = 'yyyy-MM-dd';

interface DatePickerProps {
  label?: string;
  // "yyyy-MM-dd", or an empty string when no date is set
  value: string;
  onChange: (value: string) => void;
  // Dates before today can't be picked unless this is set
  allowPast?: boolean;
}

// The date twin of TimePicker: step the day, month or year with the arrows.
export function DatePicker({ label, value, onChange, allowPast = false }: DatePickerProps) {
  const colors = useThemeStore((s) => s.colors);
  const parsed = value ? parse(value, FORMAT, new Date()) : null;
  const date = parsed && isValid(parsed) ? parsed : null;
  const today = startOfDay(new Date());

  if (!date) {
    return (
      <View style={styles.container}>
        {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          onPress={() => onChange(format(today, FORMAT))}
          style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[typography.body, { color: colors.textMuted }]}>No date set</Text>
          <Text style={[styles.action, { color: colors.primary }]}>Set a date</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const set = (next: Date) => {
    onChange(format(!allowPast && next < today ? today : next, FORMAT));
  };

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      <View style={[styles.face, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {format(date, 'EEEE')}
        </Text>
        <View style={styles.row}>
          <Segment
            name="Day"
            text={format(date, 'dd')}
            onStep={(direction) => set(addDays(date, direction))}
          />
          <Segment
            name="Month"
            text={format(date, 'MMM')}
            wide
            onStep={(direction) => set(addMonths(date, direction))}
          />
          <Segment
            name="Year"
            text={format(date, 'yyyy')}
            wide
            onStep={(direction) => set(addYears(date, direction))}
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
  text: string;
  wide?: boolean;
  onStep: (direction: 1 | -1) => void;
}

function Segment({ name, text, wide, onStep }: SegmentProps) {
  const colors = useThemeStore((s) => s.colors);
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
      <View
        style={[
          styles.digitBox,
          wide && styles.wide,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}
      >
        <Text accessibilityLabel={`${name} ${text}`} style={[styles.digits, { color: colors.text }]}>
          {text}
        </Text>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segment: {
    alignItems: 'center',
    marginHorizontal: spacing.xs,
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
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  digitBox: {
    width: 64,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  wide: {
    width: 92,
  },
  clear: {
    marginTop: spacing.sm,
  },
});
