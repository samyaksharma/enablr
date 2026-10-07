import React from 'react';
import { Alert, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '../../../components/ui/Button';
import { EmptyNote } from '../../../components/guild/GuildBits';
import { GuildTask, GuildTaskRow, isDueToday } from '../../../components/guild/GuildTaskRow';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { useThemeStore } from '../../../stores/themeStore';
import { GuildStackParamList } from '../../../navigation/GuildStack';
import { submitGuildTask } from '../../../services/guild/submitTask';
import { toDayKey } from '../../../utils/schedule';
import { attempt, shared } from '../shared';
import { spacing } from '../../../constants/theme';

// Tasks the member can act on right now come first
function needsAction(task: GuildTask): boolean {
  const status = task.mine?.status ?? null;
  return task.assignedToMe && isDueToday(task) && (status === null || status === 'rejected');
}

export function TasksTab({ guildId, canManage }: { guildId: Id<'guilds'>; canManage: boolean }) {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const today = toDayKey(new Date());
  const tasks = useCachedQuery(`guildTasks.list:${guildId}:${today}`, api.guildTasks.list, {
    guildId,
    today,
  });
  const withdraw = useMutation(api.guildTasks.withdraw);

  const confirmWithdraw = (task: GuildTask) => {
    if (!task.mine) return;
    const submissionId = task.mine._id;
    Alert.alert('Withdraw submission?', 'You can submit this task again afterwards.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: () => attempt(() => withdraw({ submissionId }), 'Submission withdrawn.'),
      },
    ]);
  };

  const todo = (tasks ?? []).filter(needsAction);
  const rest = (tasks ?? []).filter((t) => !needsAction(t));

  const renderRow = (task: GuildTask) => (
    <GuildTaskRow
      key={task._id}
      task={task}
      onComplete={submitGuildTask}
      onWithdraw={confirmWithdraw}
      onEdit={
        canManage
          ? () => navigation.navigate('GuildTaskForm', { guildId, taskId: task._id })
          : undefined
      }
    />
  );

  return (
    <View>
      {canManage ? (
        <Button
          title="New Task"
          variant="outline"
          onPress={() => navigation.navigate('GuildTaskForm', { guildId })}
          style={{ marginBottom: spacing.lg }}
        />
      ) : null}

      {tasks === undefined ? (
        <EmptyNote title="Loading the task board…" />
      ) : tasks.length === 0 ? (
        <EmptyNote
          title="The board is clear"
          body={
            canManage
              ? 'Post the first task and put the guild to work.'
              : 'No tasks yet. Check back once the staff post some.'
          }
        />
      ) : (
        <>
          {todo.length > 0 ? (
            <Text style={[shared.sectionTitle, { color: colors.textSecondary, marginTop: 0 }]}>
              For you today
            </Text>
          ) : null}
          {todo.map(renderRow)}
          {rest.length > 0 ? (
            <Text
              style={[
                shared.sectionTitle,
                { color: colors.textSecondary },
                todo.length === 0 && { marginTop: 0 },
              ]}
            >
              {todo.length > 0 ? 'Everything else' : 'All tasks'}
            </Text>
          ) : null}
          {rest.map(renderRow)}
        </>
      )}
    </View>
  );
}
