import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { Card } from '../../../components/ui/Card';
import { EmptyNote, RoleChip } from '../../../components/guild/GuildBits';
import { useCachedQuery } from '../../../hooks/useCachedQuery';
import { useThemeStore } from '../../../stores/themeStore';
import { GuildStackParamList } from '../../../navigation/GuildStack';
import { GuildMembership, shared } from '../shared';
import { spacing } from '../../../constants/theme';

export function MembersTab({
  guildId,
  membership,
}: {
  guildId: Id<'guilds'>;
  membership: GuildMembership;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const data = useCachedQuery(`guilds.members:${guildId}`, api.guilds.members, { guildId });

  if (!data) return <EmptyNote title="Loading the roster…" />;

  const permissions = membership.permissions as string[];
  const canAct =
    permissions.includes('assign_roles') ||
    permissions.includes('remove_members') ||
    membership.system === 'owner';

  return (
    <View>
      {data.members.map((member) => {
        // Only members ranked below you can be managed
        const manageable = canAct && !member.isMe && member.position > membership.position;
        const row = (
          <Card style={shared.cardGap}>
            <View style={shared.rowBetween}>
              <View style={styles.text}>
                <Text style={[shared.bodyBold, { color: colors.text }]} numberOfLines={1}>
                  {member.name}
                  {member.isMe ? ' (you)' : ''}
                </Text>
                <Text style={[shared.small, { color: colors.textMuted }]}>
                  Guild Level {member.level}
                </Text>
              </View>
              <RoleChip name={member.roleName} color={member.roleColor} iconUrl={member.roleIconUrl} />
            </View>
          </Card>
        );
        return manageable ? (
          <TouchableOpacity
            key={member.userId}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GuildMember', { guildId, userId: member.userId })}
          >
            {row}
          </TouchableOpacity>
        ) : (
          <View key={member.userId}>{row}</View>
        );
      })}
      {canAct ? (
        <Text style={[shared.small, styles.footnote, { color: colors.textMuted }]}>
          Tap a member ranked below you to change their role or remove them.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    flex: 1,
    marginRight: spacing.md,
  },
  footnote: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
