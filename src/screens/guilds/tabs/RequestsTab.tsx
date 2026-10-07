import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation } from 'convex/react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyNote } from '../../../components/guild/GuildBits';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { useThemeStore } from '../../../stores/themeStore';
import { attempt, shared } from '../shared';
import { spacing } from '../../../constants/theme';

export function RequestsTab({ guildId }: { guildId: Id<'guilds'> }) {
  const colors = useThemeStore((s) => s.colors);
  const requests = useCachedQuery(`guilds.requests:${guildId}`, api.guilds.requests, { guildId });
  const decideRequest = useMutation(api.guilds.decideRequest);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!requests) return <EmptyNote title="Loading requests…" />;
  if (requests.length === 0) {
    return (
      <EmptyNote
        title="No one at the gates"
        body="When someone asks to join, their request appears here."
      />
    );
  }

  const decide = async (requestId: Id<'guildJoinRequests'>, approve: boolean, name: string) => {
    setBusyId(requestId);
    await attempt(
      () => decideRequest({ requestId, approve }),
      approve ? `${name} has joined the guild.` : `${name}'s request was declined.`
    );
    setBusyId(null);
  };

  return (
    <View>
      {requests.map((request) => (
        <Card key={request._id} style={shared.cardGap}>
          <Text style={[shared.bodyBold, { color: colors.text }]}>{request.name}</Text>
          <Text style={[shared.small, { color: colors.textMuted }]}>
            Asked {formatDistanceToNow(request.createdAt)} ago
          </Text>
          {request.message ? (
            <Text style={[shared.caption, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              "{request.message}"
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              title="Decline"
              variant="outline"
              disabled={busyId === request._id}
              onPress={() => decide(request._id, false, request.name)}
              style={styles.action}
            />
            <Button
              title="Approve"
              loading={busyId === request._id}
              onPress={() => decide(request._id, true, request.name)}
              style={styles.action}
            />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  action: {
    flex: 1,
  },
});
