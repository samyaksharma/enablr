import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { format, parse } from 'date-fns';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { LIMITS } from '../../../convex/permissions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { DifficultyPicker } from '../../components/habits/DifficultyPicker';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { Difficulty, RecurrenceType } from '../../types';
import { RecurrenceRule, toDayKey } from '../../utils/schedule';
import { ChipGroup, Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type TaskType = 'once' | 'recurring';
type AssignType = 'everyone' | 'role' | 'members';
type RewardMode = 'on_submission' | 'on_review';

export function GuildTaskFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GuildStackParamList, 'GuildTaskForm'>>();
  const { guildId, taskId } = route.params;
  const colors = useThemeStore((s) => s.colors);

  const tasks = useQuery(api.guildTasks.list, { guildId, today: toDayKey(new Date()) });
  const roles = useQuery(api.guildRoles.list, { guildId });
  const roster = useQuery(api.guilds.members, { guildId });
  const createTask = useMutation(api.guildTasks.create);
  const updateTask = useMutation(api.guildTasks.update);
  const archiveTask = useMutation(api.guildTasks.archive);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [taskType, setTaskType] = useState<TaskType>('once');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [intervalDays, setIntervalDays] = useState('2');
  const [assignType, setAssignType] = useState<AssignType>('everyone');
  const [roleId, setRoleId] = useState<Id<'guildRoles'> | null>(null);
  const [memberIds, setMemberIds] = useState<Id<'users'>[]>([]);
  const [rewardMode, setRewardMode] = useState<RewardMode>('on_submission');
  const [proofVideo, setProofVideo] = useState(false);
  const [loaded, setLoaded] = useState(!taskId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existing = taskId ? tasks?.find((t) => t._id === taskId) : undefined;

  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name);
    setDescription(existing.description);
    setDifficulty(existing.difficulty as Difficulty);
    const rule = existing.recurrence as RecurrenceRule | null;
    setTaskType(rule ? 'recurring' : 'once');
    if (rule) {
      setRecurrenceType(rule.type);
      setSelectedDays(rule.days ?? []);
      setIntervalDays(String(rule.every ?? 2));
    }
    setDueDate(existing.dueAt ? format(new Date(existing.dueAt), 'yyyy-MM-dd') : '');
    setAssignType(existing.assignment.type);
    if (existing.assignment.type === 'role') setRoleId(existing.assignment.roleId);
    if (existing.assignment.type === 'members') setMemberIds(existing.assignment.userIds);
    setRewardMode(existing.rewardMode);
    setProofVideo(existing.proofVideoRequired);
    setLoaded(true);
  }, [existing, loaded]);

  if (!loaded || !roles || !roster) return <Loading />;

  const save = async () => {
    if (!name.trim()) return setError('Give the task a name.');

    let recurrence: RecurrenceRule | null = null;
    let dueAt: number | undefined;
    if (taskType === 'recurring') {
      if (recurrenceType === 'specific_days' && selectedDays.length === 0) {
        return setError('Pick at least one day for this task.');
      }
      recurrence = {
        type: recurrenceType,
        ...(recurrenceType === 'specific_days' && { days: selectedDays }),
        ...(recurrenceType === 'interval' && { every: parseInt(intervalDays, 10) || 2 }),
      };
    } else if (dueDate) {
      const parsed = parse(dueDate, 'yyyy-MM-dd', new Date());
      // Due at the end of that day
      dueAt = parsed.getTime() + 24 * 60 * 60 * 1000 - 1;
    }

    let assignment:
      | { type: 'everyone' }
      | { type: 'role'; roleId: Id<'guildRoles'> }
      | { type: 'members'; userIds: Id<'users'>[] } = { type: 'everyone' };
    if (assignType === 'role') {
      if (!roleId) return setError('Choose which role this task is for.');
      assignment = { type: 'role', roleId };
    } else if (assignType === 'members') {
      if (memberIds.length === 0) return setError('Choose at least one member for this task.');
      assignment = { type: 'members', userIds: memberIds };
    }

    setError('');
    setSaving(true);
    const fields = {
      name,
      description,
      difficulty,
      recurrence,
      dueAt,
      assignment,
      rewardMode,
      proofVideoRequired: proofVideo,
    };
    const ok = await attempt(
      () => (taskId ? updateTask({ taskId, ...fields }) : createTask({ guildId, ...fields })),
      taskId ? 'Task updated.' : 'Task posted to the board.'
    );
    setSaving(false);
    if (ok) navigation.goBack();
  };

  const confirmArchive = () => {
    if (!taskId) return;
    Alert.alert(
      'Archive this task?',
      'It comes off the board. Everything already submitted for it is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (await attempt(() => archiveTask({ taskId }), 'Task archived.')) navigation.goBack();
          },
        },
      ]
    );
  };

  const toggleDay = (day: number) =>
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  const toggleMember = (userId: Id<'users'>) =>
    setMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <Input
        label="Task Name"
        placeholder="e.g., Run 5 km"
        value={name}
        onChangeText={setName}
        maxLength={LIMITS.taskNameMax}
      />
      <Input
        label="Description (optional)"
        placeholder="What counts as done?"
        value={description}
        onChangeText={setDescription}
        maxLength={LIMITS.taskDescriptionMax}
        multiline
        numberOfLines={3}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />

      <DifficultyPicker value={difficulty} onChange={setDifficulty} />

      <Text style={[shared.label, { color: colors.textSecondary }]}>Type</Text>
      <ChipGroup
        options={[
          { key: 'once', label: 'One-off' },
          { key: 'recurring', label: 'Recurring' },
        ]}
        selected={[taskType]}
        onToggle={setTaskType}
      />

      {taskType === 'once' ? (
        <DatePicker label="Due date (optional)" value={dueDate} onChange={setDueDate} />
      ) : (
        <>
          <ChipGroup
            options={[
              { key: 'daily', label: 'Daily' },
              { key: 'specific_days', label: 'Specific Days' },
              { key: 'interval', label: 'Every X Days' },
            ]}
            selected={[recurrenceType]}
            onToggle={setRecurrenceType}
          />
          {recurrenceType === 'specific_days' ? (
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
          ) : null}
          {recurrenceType === 'interval' ? (
            <Input
              label="Every how many days?"
              placeholder="2"
              value={intervalDays}
              onChangeText={setIntervalDays}
              keyboardType="number-pad"
            />
          ) : null}
        </>
      )}

      <Text style={[shared.label, { color: colors.textSecondary }]}>Who is it for?</Text>
      <ChipGroup
        options={[
          { key: 'everyone', label: 'Everyone' },
          { key: 'role', label: 'A role' },
          { key: 'members', label: 'Specific members' },
        ]}
        selected={[assignType]}
        onToggle={setAssignType}
      />
      {assignType === 'role' ? (
        <ChipGroup
          options={roles.map((role) => ({ key: role._id, label: role.name, color: role.color }))}
          selected={roleId ? [roleId] : []}
          onToggle={setRoleId}
        />
      ) : null}
      {assignType === 'members' ? (
        <ChipGroup
          options={roster.members.map((m) => ({ key: m.userId, label: m.name }))}
          selected={memberIds}
          onToggle={toggleMember}
        />
      ) : null}

      <Text style={[shared.label, { color: colors.textSecondary }]}>Reward</Text>
      <ChipGroup
        options={[
          { key: 'on_submission', label: 'On submission' },
          { key: 'on_review', label: 'After review' },
        ]}
        selected={[rewardMode]}
        onToggle={setRewardMode}
      />
      <Text style={[shared.hint, { color: colors.textMuted }]}>
        {rewardMode === 'on_submission'
          ? 'XP is awarded the moment the task is submitted. A reviewer can still revoke it within 7 days.'
          : 'The submission waits in the review queue. XP is awarded only when a reviewer approves it.'}
      </Text>

      <View style={[shared.rowBetween, { marginBottom: spacing.sm }]}>
        <Text style={[shared.body, { color: colors.text }]}>Require a proof video</Text>
        <Switch
          value={proofVideo}
          onValueChange={setProofVideo}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
      <Text style={[shared.hint, { color: colors.textMuted, marginTop: 0 }]}>
        {proofVideo
          ? 'Members must attach a video of up to 60 seconds to submit. Only they and reviewers can watch it.'
          : 'Members complete the task with a tap.'}
      </Text>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button
        title={taskId ? 'Save Changes' : 'Post Task'}
        onPress={save}
        loading={saving}
        size="lg"
      />
      {taskId ? (
        <>
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Changes apply to future submissions only.
          </Text>
          <Button
            title="Archive Task"
            variant="ghost"
            textStyle={{ color: colors.error }}
            onPress={confirmArchive}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  error: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  note: {
    ...typography.small,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
});
