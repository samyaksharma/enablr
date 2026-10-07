import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from 'convex/react';
import { format } from 'date-fns';
import { api } from '../../../convex/_generated/api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { GuildEmblem, GuildLevelBar, RoleChip } from '../../components/guild/GuildBits';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

export function GuildsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const data = useCachedQuery('guilds.myGuilds', api.guilds.myGuilds, {});
  const restoreGuild = useMutation(api.guilds.restoreGuild);

  if (!data) return <Loading />;
  const { guilds, pending, deleted } = data;
  const isEmpty = guilds.length === 0 && pending.length === 0 && deleted.length === 0;

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[shared.title, { color: colors.text, marginBottom: spacing.lg }]}>Guilds</Text>

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>{'🚩'}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Find your banner</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Join a guild to take on shared tasks and earn a rank of your own there, or found one and
            lead it.
          </Text>
        </View>
      ) : null}

      {guilds.map((guild) => (
        <TouchableOpacity
          key={guild._id}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Guild', { guildId: guild._id })}
        >
          <Card style={shared.cardGap}>
            <View style={shared.row}>
              <GuildEmblem url={guild.emblemUrl} name={guild.name} size={52} />
              <View style={styles.guildText}>
                <Text style={[shared.bodyBold, { color: colors.text }]} numberOfLines={1}>
                  {guild.name}
                </Text>
                <View style={styles.roleLine}>
                  <RoleChip name={guild.roleName} color={guild.roleColor} iconUrl={guild.roleIconUrl} />
                  <Text style={[shared.small, { color: colors.textMuted }]}>
                    {guild.memberCount} {guild.memberCount === 1 ? 'member' : 'members'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.levelBar}>
              <GuildLevelBar xp={guild.xp} compact />
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {pending.length > 0 ? (
        <>
          <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>
            Waiting for approval
          </Text>
          {pending.map((guild) => (
            <TouchableOpacity
              key={guild._id}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Guild', { guildId: guild._id })}
            >
              <Card style={shared.cardGap}>
                <View style={shared.row}>
                  <GuildEmblem url={guild.emblemUrl} name={guild.name} size={40} />
                  <View style={styles.guildText}>
                    <Text style={[shared.bodyBold, { color: colors.text }]} numberOfLines={1}>
                      {guild.name}
                    </Text>
                    <Text style={[shared.small, { color: colors.warning }]}>
                      Request sent. The guild's staff will decide.
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      {deleted.length > 0 ? (
        <>
          <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>Deleted guilds</Text>
          {deleted.map((guild) => (
            <Card key={guild._id} style={shared.cardGap}>
              <Text style={[shared.bodyBold, { color: colors.text }]}>{guild.name}</Text>
              <Text style={[shared.small, { color: colors.textSecondary }]}>
                Removed for good on {format(new Date(guild.purgeAt), 'MMM d')}.
              </Text>
              <Button
                title="Restore"
                variant="outline"
                size="sm"
                style={{ marginTop: spacing.md }}
                onPress={() =>
                  attempt(() => restoreGuild({ guildId: guild._id }), `${guild.name} is back.`)
                }
              />
            </Card>
          ))}
        </>
      ) : null}

      <Button
        title="Find a Guild"
        onPress={() => navigation.navigate('GuildSearch')}
        size="lg"
        style={{ marginTop: spacing.xl }}
      />
      <Button
        title="Found a Guild"
        onPress={() => navigation.navigate('GuildForm', {})}
        variant="outline"
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h2,
  },
  emptyBody: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  guildText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  roleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  levelBar: {
    marginTop: spacing.md,
  },
});
