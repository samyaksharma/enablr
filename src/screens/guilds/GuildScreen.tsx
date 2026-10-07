import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMutation } from 'convex/react';
import { format } from 'date-fns';
import { api } from '../../../convex/_generated/api';
import { LIMITS } from '../../../convex/permissions';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import {
  EmptyNote,
  GuildEmblem,
  GuildLevelBar,
  RoleChip,
  SegmentedTabs,
} from '../../components/guild/GuildBits';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { GuildOverview, Loading, attempt, shared } from './shared';
import { TasksTab } from './tabs/TasksTab';
import { MembersTab } from './tabs/MembersTab';
import { ReviewTab } from './tabs/ReviewTab';
import { RequestsTab } from './tabs/RequestsTab';
import { MoreTab } from './tabs/MoreTab';
import { spacing, typography } from '../../constants/theme';

type TabKey = 'tasks' | 'members' | 'review' | 'requests' | 'more';

export function GuildScreen() {
  const route = useRoute<RouteProp<GuildStackParamList, 'Guild'>>();
  const { guildId } = route.params;
  const colors = useThemeStore((s) => s.colors);
  const guild = useCachedQuery(`guilds.overview:${guildId}`, api.guilds.overview, { guildId });
  const [tab, setTab] = useState<TabKey>('tasks');

  if (guild === undefined) return <Loading />;
  if (guild === null) {
    return (
      <View style={[shared.screen, { backgroundColor: colors.background }]}>
        <EmptyNote
          title="This guild is gone"
          body="It was deleted by its owner. Head back to find another banner to rally under."
        />
      </View>
    );
  }

  const membership = guild.membership;
  if (!membership) return <PublicGuildPage guild={guild} />;

  const can = (permission: string) => (membership.permissions as string[]).includes(permission);
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'tasks', label: 'Tasks' },
    { key: 'members', label: 'Members' },
  ];
  if (can('review_submissions')) {
    tabs.push({ key: 'review', label: 'Review', badge: guild.pendingReviews });
  }
  if (can('manage_requests')) {
    tabs.push({ key: 'requests', label: 'Requests', badge: guild.pendingRequests });
  }
  tabs.push({ key: 'more', label: 'More' });
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'tasks';

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <GuildEmblem url={guild.emblemUrl} name={guild.name} size={72} />
        <View style={styles.headerText}>
          <Text style={[styles.name, { color: colors.text }]}>{guild.name}</Text>
          <View style={styles.roleLine}>
            <RoleChip
              name={membership.roleName}
              color={membership.roleColor}
              iconUrl={membership.roleIconUrl}
            />
            <Text style={[shared.small, { color: colors.textMuted }]}>
              {guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.levelBar}>
        <GuildLevelBar xp={membership.xp} />
      </View>

      <SegmentedTabs tabs={tabs} value={activeTab} onChange={setTab} />

      <View style={styles.tabContent}>
        {activeTab === 'tasks' ? (
          <TasksTab guildId={guildId} canManage={can('manage_tasks')} />
        ) : null}
        {activeTab === 'members' ? <MembersTab guildId={guildId} membership={membership} /> : null}
        {activeTab === 'review' ? <ReviewTab guildId={guildId} /> : null}
        {activeTab === 'requests' ? <RequestsTab guildId={guildId} /> : null}
        {activeTab === 'more' ? <MoreTab guild={guild} membership={membership} /> : null}
      </View>
    </ScrollView>
  );
}

// What a non-member sees: the emblem, name, description, member count and the
// guild's staff. Nothing else about the guild is sent to them.
function PublicGuildPage({ guild }: { guild: GuildOverview }) {
  const colors = useThemeStore((s) => s.colors);
  const requestJoin = useMutation(api.guilds.requestJoin);
  const cancelRequest = useMutation(api.guilds.cancelRequest);
  const reportGuild = useMutation(api.guilds.report);
  const [message, setMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const request = guild.request;
  const waitUntil = request?.status === 'denied' && request.canRequestAt > Date.now()
    ? request.canRequestAt
    : null;

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    const ok = await attempt(action, success);
    setBusy(false);
    return ok;
  };

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.publicHeader}>
        <GuildEmblem url={guild.emblemUrl} name={guild.name} size={112} />
        <Text style={[styles.publicName, { color: colors.text }]}>{guild.name}</Text>
        <Text style={[shared.caption, { color: colors.textMuted }]}>
          {guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'}
        </Text>
      </View>

      <Text style={[shared.body, { color: colors.textSecondary }]}>{guild.description}</Text>

      <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>Run by</Text>
      <Card>
        {guild.staff.map((person, index) => (
          <View
            key={person.userId}
            style={[shared.rowBetween, index > 0 && { marginTop: spacing.md }]}
          >
            <Text style={[shared.body, { color: colors.text }]} numberOfLines={1}>
              {person.name}
            </Text>
            <RoleChip name={person.roleName} color={person.roleColor} />
          </View>
        ))}
      </Card>

      <View style={styles.joinBlock}>
        {request?.status === 'pending' ? (
          <>
            <Text style={[styles.waiting, { color: colors.warning }]}>
              Your request is with the guild's staff. You'll get a notification when they decide.
            </Text>
            <Button
              title="Cancel Request"
              variant="outline"
              loading={busy}
              onPress={() =>
                run(() => cancelRequest({ requestId: request.requestId }), 'Request cancelled.')
              }
            />
          </>
        ) : waitUntil ? (
          <Text style={[styles.waiting, { color: colors.textSecondary }]}>
            Your last request was declined. You can ask again on{' '}
            {format(new Date(waitUntil), 'MMM d')}.
          </Text>
        ) : (
          <>
            <Input
              label="Message to the staff (optional)"
              placeholder="Why you'd like to join"
              value={message}
              onChangeText={setMessage}
              maxLength={LIMITS.joinMessageMax}
              multiline
            />
            <Button
              title="Request to Join"
              size="lg"
              loading={busy}
              onPress={() =>
                run(() => requestJoin({ guildId: guild._id, message }), 'Request sent.')
              }
            />
          </>
        )}
      </View>

      {reporting ? (
        <View style={{ marginTop: spacing.xl }}>
          <Input
            label="What's wrong with this guild?"
            placeholder="Describe the problem"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Button
            title="Send Report"
            variant="outline"
            loading={busy}
            onPress={async () => {
              const ok = await run(
                () => reportGuild({ guildId: guild._id, reason }),
                'Report sent. Thank you.'
              );
              if (ok) {
                setReporting(false);
                setReason('');
              }
            }}
          />
        </View>
      ) : (
        <Button
          title="Report this guild"
          variant="ghost"
          size="sm"
          style={{ marginTop: spacing.xl }}
          textStyle={{ color: colors.textMuted }}
          onPress={() => setReporting(true)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  name: {
    ...typography.h2,
  },
  roleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  levelBar: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  tabContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  publicHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  publicName: {
    ...typography.h1,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  joinBlock: {
    marginTop: spacing.xl,
  },
  waiting: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
