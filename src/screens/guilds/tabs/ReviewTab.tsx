import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useMutation } from 'convex/react';
import { FunctionReturnType } from 'convex/server';
import { useVideoPlayer, VideoView } from 'expo-video';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { LIMITS } from '../../../../convex/permissions';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { EmptyNote } from '../../../components/guild/GuildBits';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { useThemeStore } from '../../../stores/themeStore';
import { attempt, shared } from '../shared';
import { borderRadius, spacing } from '../../../constants/theme';

type Submission = FunctionReturnType<typeof api.guildTasks.reviewQueue>['pending'][number];

function ProofVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
}

function PendingCard({ guildId, submission }: { guildId: Id<'guilds'>; submission: Submission }) {
  const colors = useThemeStore((s) => s.colors);
  const review = useMutation(api.guildTasks.review);
  const report = useMutation(api.guilds.report);
  const [watching, setWatching] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (approve: boolean) => {
    setBusy(true);
    await attempt(
      () => review({ submissionId: submission._id, approve, note: approve ? undefined : note }),
      approve ? 'Approved. XP awarded.' : 'Sent back with your note.'
    );
    setBusy(false);
  };

  const confirmReport = () => {
    Alert.alert('Report this video?', 'It will be logged for the app operator to look at.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          attempt(
            () =>
              report({ guildId, submissionId: submission._id, reason: 'Abusive proof video' }),
            'Report sent. Thank you.'
          ),
      },
    ]);
  };

  return (
    <Card style={shared.cardGap}>
      <Text style={[shared.bodyBold, { color: colors.text }]}>{submission.taskName}</Text>
      <Text style={[shared.caption, { color: colors.textSecondary }]}>
        {submission.submitterName} · {formatDistanceToNow(submission.submittedAt)} ago
      </Text>

      {submission.videoUrl ? (
        watching ? (
          <ProofVideo url={submission.videoUrl} />
        ) : (
          <Button
            title="Watch proof video"
            variant="secondary"
            size="sm"
            style={{ marginTop: spacing.md }}
            onPress={() => setWatching(true)}
          />
        )
      ) : (
        <Text style={[shared.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
          No video for this task. Approve it if the work was done.
        </Text>
      )}

      {rejecting ? (
        <View style={{ marginTop: spacing.md }}>
          <Input
            label="What needs fixing?"
            placeholder="They'll see this note"
            value={note}
            onChangeText={setNote}
            maxLength={LIMITS.reviewNoteMax}
            multiline
          />
          <View style={styles.actions}>
            <Button title="Cancel" variant="ghost" onPress={() => setRejecting(false)} style={styles.action} />
            <Button
              title="Send Back"
              variant="outline"
              loading={busy}
              disabled={!note.trim()}
              onPress={() => decide(false)}
              style={styles.action}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            title="Reject"
            variant="outline"
            onPress={() => setRejecting(true)}
            style={styles.action}
          />
          <Button title="Approve" loading={busy} onPress={() => decide(true)} style={styles.action} />
        </View>
      )}

      {submission.videoUrl ? (
        <Button
          title="Report video"
          variant="ghost"
          size="sm"
          textStyle={{ color: colors.textMuted }}
          onPress={confirmReport}
        />
      ) : null}
    </Card>
  );
}

export function ReviewTab({ guildId }: { guildId: Id<'guilds'> }) {
  const colors = useThemeStore((s) => s.colors);
  const queue = useCachedQuery(`guildTasks.reviewQueue:${guildId}`, api.guildTasks.reviewQueue, {
    guildId,
  });
  const revoke = useMutation(api.guildTasks.revoke);

  if (!queue) return <EmptyNote title="Loading the queue…" />;

  const confirmRevoke = (submission: Submission) => {
    Alert.alert(
      'Revoke this approval?',
      `${submission.submitterName} will lose the ${submission.xpAwarded} XP it awarded.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () =>
            attempt(() => revoke({ submissionId: submission._id }), 'Approval revoked.'),
        },
      ]
    );
  };

  return (
    <View>
      {queue.pending.length === 0 ? (
        <EmptyNote title="Nothing waiting" body="New submissions show up here, oldest first." />
      ) : (
        queue.pending.map((submission) => (
          <PendingCard key={submission._id} guildId={guildId} submission={submission} />
        ))
      )}

      {queue.recent.length > 0 ? (
        <>
          <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>
            Approved in the last 7 days
          </Text>
          {queue.recent.map((submission) => (
            <Card key={submission._id} style={shared.cardGap}>
              <View style={shared.rowBetween}>
                <View style={{ flex: 1, marginRight: spacing.md }}>
                  <Text style={[shared.bodyBold, { color: colors.text }]} numberOfLines={1}>
                    {submission.taskName}
                  </Text>
                  <Text style={[shared.small, { color: colors.textSecondary }]}>
                    {submission.submitterName} · +{submission.xpAwarded} XP
                  </Text>
                </View>
                <Button
                  title="Revoke"
                  variant="ghost"
                  size="sm"
                  textStyle={{ color: colors.error }}
                  onPress={() => confirmRevoke(submission)}
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 420,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    backgroundColor: '#000000',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
  },
});
