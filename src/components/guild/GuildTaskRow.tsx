import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { Card } from '../ui/Card';
import { Tag } from './GuildBits';
import { useThemeStore } from '../../stores/themeStore';
import { useGuildFeedbackStore } from '../../stores/guildFeedbackStore';
import { dayNumber, isScheduledOnDay, toDayKey } from '../../utils/schedule';
import { borderRadius, spacing, typography } from '../../constants/theme';

export type GuildTask = FunctionReturnType<typeof api.guildTasks.list>[number];

export function isDueToday(task: GuildTask, today: Date = new Date()): boolean {
  if (!task.recurrence) return true;
  return isScheduledOnDay(task.recurrence, dayNumber(toDayKey(today)), task.createdDay);
}

function nextDueLabel(task: GuildTask): string {
  if (!task.recurrence) return '';
  const today = dayNumber(toDayKey(new Date()));
  for (let offset = 1; offset <= 366; offset++) {
    if (isScheduledOnDay(task.recurrence, today + offset, task.createdDay)) {
      if (offset === 1) return 'Due tomorrow';
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return `Next due ${format(date, offset < 7 ? 'EEEE' : 'MMM d')}`;
    }
  }
  return '';
}

function scheduleLabel(task: GuildTask): string {
  const rule = task.recurrence;
  if (!rule) return task.dueAt ? `Due ${format(new Date(task.dueAt), 'MMM d')}` : 'One-off';
  if (rule.type === 'daily') return 'Daily';
  if (rule.type === 'interval') return `Every ${rule.every} days`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...(rule.days ?? [])]
    .sort()
    .map((d: number) => names[d])
    .join(' ');
}

interface GuildTaskRowProps {
  task: GuildTask;
  onComplete: (task: GuildTask) => void;
  onWithdraw?: (task: GuildTask) => void;
  onEdit?: (task: GuildTask) => void;
}

export function GuildTaskRow({ task, onComplete, onWithdraw, onEdit }: GuildTaskRowProps) {
  const colors = useThemeStore((s) => s.colors);
  const busy = useGuildFeedbackStore((s) => s.busyTaskIds.includes(task._id));
  const status = task.mine?.status ?? null;
  const dueToday = isDueToday(task);
  const overdue = !task.recurrence && !!task.dueAt && task.dueAt < Date.now() && status !== 'approved';
  const canSubmit = task.assignedToMe && dueToday && (status === null || status === 'rejected');

  let state: React.ReactNode = null;
  if (busy) {
    state = (
      <View style={styles.stateRow}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.stateText, { color: colors.textSecondary }]}>
          {task.proofVideoRequired ? 'Uploading video…' : 'Submitting…'}
        </Text>
      </View>
    );
  } else if (status === 'approved') {
    state = (
      <Text style={[styles.stateText, { color: colors.success }]}>
        {'✓'} Done · +{task.mine?.xpAwarded} XP
      </Text>
    );
  } else if (status === 'pending_review') {
    state = (
      <View style={styles.stateRow}>
        <Text style={[styles.stateText, { color: colors.warning }]}>
          Waiting for a reviewer. XP arrives on approval.
        </Text>
        {onWithdraw ? (
          <TouchableOpacity onPress={() => onWithdraw(task)} hitSlop={8}>
            <Text style={[styles.link, { color: colors.textSecondary }]}>Withdraw</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else if (status === 'revoked') {
    state = (
      <Text style={[styles.stateText, { color: colors.error }]}>
        Revoked by a reviewer{task.mine?.reviewNote ? `: ${task.mine.reviewNote}` : ''}
      </Text>
    );
  } else if (!task.assignedToMe) {
    state = (
      <Text style={[styles.stateText, { color: colors.textMuted }]}>Assigned to: {task.assignedTo}</Text>
    );
  } else if (!dueToday) {
    state = <Text style={[styles.stateText, { color: colors.textMuted }]}>{nextDueLabel(task)}</Text>;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: colors.text }]}>{task.name}</Text>
          {task.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
              {task.description}
            </Text>
          ) : null}
        </View>
        {onEdit ? (
          <TouchableOpacity onPress={() => onEdit(task)} hitSlop={8}>
            <Text style={[styles.link, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.tags}>
        <Tag label={`${task.baseXp} XP`} color={colors.gold} />
        <Tag label={scheduleLabel(task)} color={overdue ? colors.error : colors.textSecondary} />
        {task.proofVideoRequired ? <Tag label="Proof video" color={colors.accent} /> : null}
        {task.rewardMode === 'on_review' ? <Tag label="Reviewed" color={colors.primary} /> : null}
        {task.streak > 1 ? <Tag label={`🔥 ${task.streak}`} color={colors.gold} /> : null}
      </View>

      {status === 'rejected' && !busy ? (
        <Text style={[styles.stateText, { color: colors.error }]}>
          Sent back: {task.mine?.reviewNote ?? 'no note given'}
        </Text>
      ) : null}

      {state}

      {canSubmit && !busy ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => onComplete(task)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {status === 'rejected'
              ? 'Submit again'
              : task.proofVideoRequired
                ? 'Add proof video'
                : 'Complete'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    marginRight: spacing.md,
  },
  name: {
    ...typography.bodyBold,
  },
  description: {
    ...typography.caption,
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stateText: {
    ...typography.caption,
    marginTop: spacing.sm,
    flexShrink: 1,
  },
  link: {
    ...typography.caption,
    fontWeight: '700',
  },
  button: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
