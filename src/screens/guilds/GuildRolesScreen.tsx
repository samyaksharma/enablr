import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { LIMITS, PERMISSION_LABELS, Permission } from '../../../convex/permissions';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { RoleChip } from '../../components/guild/GuildBits';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

export function GuildRolesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const route = useRoute<RouteProp<GuildStackParamList, 'GuildRoles'>>();
  const { guildId } = route.params;
  const colors = useThemeStore((s) => s.colors);
  const roles = useCachedQuery(`guildRoles.list:${guildId}`, api.guildRoles.list, { guildId });
  const guild = useCachedQuery(`guilds.overview:${guildId}`, api.guilds.overview, { guildId });
  const moveRole = useMutation(api.guildRoles.move);

  if (!roles || !guild) return <Loading />;

  const canManage = ((guild.membership?.permissions ?? []) as string[]).includes('manage_roles');
  const customCount = roles.filter((r) => !r.system).length;
  // Owner and Member are fixed at the top and bottom; everything else can move
  const movable = roles.filter((r) => r.system !== 'owner' && r.system !== 'member');

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
    >
      <Text style={[shared.caption, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
        Roles are ranked from top to bottom. A member can only manage roles and members ranked
        below their own.
      </Text>

      {roles.map((role) => {
        const index = movable.findIndex((r) => r._id === role._id);
        const above = index > 0 ? movable[index - 1] : undefined;
        const below = index >= 0 ? movable[index + 1] : undefined;
        const summary =
          role.system === 'owner'
            ? 'Everything, including transferring or deleting the guild'
            : role.permissions.length === 0
              ? 'Completes tasks'
              : role.permissions.map((p) => PERMISSION_LABELS[p as Permission]).join(' · ');

        return (
          <Card key={role._id} style={shared.cardGap}>
            <View style={shared.rowBetween}>
              <RoleChip name={role.name} color={role.color} iconUrl={role.iconUrl} />
              <Text style={[shared.small, { color: colors.textMuted }]}>
                {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <Text style={[shared.small, styles.summary, { color: colors.textSecondary }]}>
              {summary}
            </Text>

            {role.canEdit ? (
              <View style={styles.actions}>
                <TouchableOpacity
                  disabled={!above?.canEdit}
                  onPress={() => attempt(() => moveRole({ roleId: role._id, direction: 'up' }))}
                  hitSlop={8}
                >
                  <Text
                    style={[styles.link, { color: above?.canEdit ? colors.primary : colors.border }]}
                  >
                    {'▲'} Up
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={!below?.canEdit}
                  onPress={() => attempt(() => moveRole({ roleId: role._id, direction: 'down' }))}
                  hitSlop={8}
                >
                  <Text
                    style={[styles.link, { color: below?.canEdit ? colors.primary : colors.border }]}
                  >
                    {'▼'} Down
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('GuildRoleForm', { guildId, roleId: role._id })}
                  hitSlop={8}
                >
                  <Text style={[styles.link, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </Card>
        );
      })}

      {canManage ? (
        customCount < LIMITS.customRoles ? (
          <Button
            title="New Role"
            onPress={() => navigation.navigate('GuildRoleForm', { guildId })}
            style={{ marginTop: spacing.md }}
          />
        ) : (
          <Text style={[shared.small, styles.limit, { color: colors.textMuted }]}>
            This guild has the maximum of {LIMITS.customRoles} custom roles.
          </Text>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summary: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  link: {
    ...typography.caption,
    fontWeight: '700',
  },
  limit: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
