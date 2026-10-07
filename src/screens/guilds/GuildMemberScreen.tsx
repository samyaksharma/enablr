import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { format } from 'date-fns';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyNote, RoleChip } from '../../components/guild/GuildBits';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

export function GuildMemberScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GuildStackParamList, 'GuildMember'>>();
  const { guildId, userId } = route.params;
  const colors = useThemeStore((s) => s.colors);

  const guild = useQuery(api.guilds.overview, { guildId });
  const roster = useQuery(api.guilds.members, { guildId });
  const roles = useQuery(api.guildRoles.list, { guildId });
  const assignRole = useMutation(api.guildRoles.assign);
  const removeMember = useMutation(api.guilds.removeMember);
  const transferOwnership = useMutation(api.guilds.transferOwnership);
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);

  if (!guild || !roster || !roles) return <Loading />;

  const member = roster.members.find((m) => m.userId === userId);
  const mine = guild.membership;
  if (!member || !mine) {
    return (
      <View style={[shared.screen, { backgroundColor: colors.background }]}>
        <EmptyNote title="No longer in the guild" body="This adventurer has left or was removed." />
      </View>
    );
  }

  const permissions = mine.permissions as string[];
  const outranked = member.position > mine.position;
  const canAssign = permissions.includes('assign_roles') && outranked;
  const canRemove = permissions.includes('remove_members') && outranked;
  const isOwner = mine.system === 'owner';
  const assignable = roles.filter((r) => r.canAssign);

  const choose = async (roleId: Id<'guildRoles'>, roleName: string) => {
    if (roleId === member.roleId) return;
    setBusyRoleId(roleId);
    await attempt(
      () => assignRole({ guildId, userId, roleId }),
      `${member.name} is now ${roleName}.`
    );
    setBusyRoleId(null);
  };

  const confirmRemove = () => {
    Alert.alert(
      `Remove ${member.name}?`,
      'They lose access to the guild. Their guild level is kept in case they rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (await attempt(() => removeMember({ guildId, userId }), `${member.name} was removed.`)) {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const confirmTransfer = () => {
    Alert.alert(
      `Make ${member.name} the Owner?`,
      `They take full control of ${guild.name}, and you become an Admin. Only they can hand it back.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: async () => {
            if (
              await attempt(
                () => transferOwnership({ guildId, userId }),
                `${member.name} now owns ${guild.name}.`
              )
            ) {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
    >
      <View style={styles.header}>
        <Text style={[styles.name, { color: colors.text }]}>{member.name}</Text>
        <View>
          <RoleChip name={member.roleName} color={member.roleColor} iconUrl={member.roleIconUrl} />
        </View>
        <Text style={[shared.caption, { color: colors.textMuted, marginTop: spacing.sm }]}>
          Guild Level {member.level}
          {member.joinedAt ? ` · joined ${format(new Date(member.joinedAt), 'MMM d, yyyy')}` : ''}
        </Text>
      </View>

      {canAssign ? (
        <>
          <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>Role</Text>
          {assignable.map((role) => {
            const selected = role._id === member.roleId;
            return (
              <TouchableOpacity
                key={role._id}
                activeOpacity={0.8}
                disabled={busyRoleId !== null}
                onPress={() => choose(role._id, role.name)}
              >
                <Card
                  style={[
                    shared.cardGap,
                    selected && { borderColor: colors.primary, borderWidth: 2 },
                  ]}
                >
                  <View style={shared.rowBetween}>
                    <RoleChip name={role.name} color={role.color} iconUrl={role.iconUrl} />
                    <Text style={[shared.small, { color: colors.textMuted }]}>
                      {busyRoleId === role._id ? 'Saving…' : selected ? 'Current role' : ''}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      ) : null}

      {canRemove ? (
        <Button
          title="Remove from Guild"
          variant="outline"
          textStyle={{ color: colors.error }}
          onPress={confirmRemove}
          style={{ marginTop: spacing.lg }}
        />
      ) : null}
      {isOwner ? (
        <Button
          title="Transfer Ownership"
          variant="ghost"
          onPress={confirmTransfer}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
  },
  name: {
    ...typography.h2,
    marginBottom: spacing.sm,
  },
});
