import React, { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { RoleChip } from '../../../components/guild/GuildBits';
import { useThemeStore } from '../../../stores/themeStore';
import { GuildStackParamList } from '../../../navigation/GuildStack';
import { GuildMembership, GuildOverview, attempt, shared } from '../shared';
import { spacing } from '../../../constants/theme';

export function MoreTab({
  guild,
  membership,
}: {
  guild: GuildOverview;
  membership: GuildMembership;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const setMuted = useMutation(api.guilds.setMuted);
  const leave = useMutation(api.guilds.leave);
  const deleteGuild = useMutation(api.guilds.deleteGuild);
  const reportGuild = useMutation(api.guilds.report);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');

  const guildId = guild._id;
  const isOwner = membership.system === 'owner';
  const canEdit = (membership.permissions as string[]).includes('edit_guild');

  const confirmLeave = () => {
    Alert.alert(
      `Leave ${guild.name}?`,
      'Your guild level is kept and comes back if you rejoin.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (await attempt(() => leave({ guildId }), `You left ${guild.name}.`)) {
              navigation.popToTop();
            }
          },
        },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${guild.name}?`,
      'The guild disappears for everyone now. You have 7 days to restore it from the Guilds tab before its tasks, submissions and files are removed for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (await attempt(() => deleteGuild({ guildId }), `${guild.name} was deleted.`)) {
              navigation.popToTop();
            }
          },
        },
      ]
    );
  };

  return (
    <View>
      <Card style={shared.cardGap}>
        <Text style={[shared.body, { color: colors.textSecondary }]}>{guild.description}</Text>
      </Card>

      <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>Run by</Text>
      <Card style={shared.cardGap}>
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

      <Text style={[shared.sectionTitle, { color: colors.textSecondary }]}>Your settings</Text>
      <Card style={shared.cardGap}>
        <View style={shared.rowBetween}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={[shared.body, { color: colors.text }]}>Mute notifications</Text>
            <Text style={[shared.small, { color: colors.textMuted }]}>
              Stop pushes from this guild. Nothing else changes.
            </Text>
          </View>
          <Switch
            value={membership.muted}
            onValueChange={(muted) => {
              attempt(() => setMuted({ guildId, muted }));
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </Card>

      <Button
        title="Roles"
        variant="outline"
        onPress={() => navigation.navigate('GuildRoles', { guildId })}
        style={{ marginTop: spacing.md }}
      />
      {canEdit ? (
        <Button
          title="Edit Guild Profile"
          variant="outline"
          onPress={() => navigation.navigate('GuildForm', { guildId })}
          style={{ marginTop: spacing.md }}
        />
      ) : null}

      {isOwner ? (
        <>
          <Text style={[shared.small, { color: colors.textMuted, marginTop: spacing.xl }]}>
            To leave, first hand the guild to another member: open the Members tab, tap them, and
            choose Transfer Ownership.
          </Text>
          <Button
            title="Delete Guild"
            variant="ghost"
            textStyle={{ color: colors.error }}
            onPress={confirmDelete}
            style={{ marginTop: spacing.sm }}
          />
        </>
      ) : (
        <Button
          title="Leave Guild"
          variant="ghost"
          textStyle={{ color: colors.error }}
          onPress={confirmLeave}
          style={{ marginTop: spacing.xl }}
        />
      )}

      {reporting ? (
        <View style={{ marginTop: spacing.lg }}>
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
            onPress={async () => {
              if (await attempt(() => reportGuild({ guildId, reason }), 'Report sent. Thank you.')) {
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
          textStyle={{ color: colors.textMuted }}
          onPress={() => setReporting(true)}
        />
      )}
    </View>
  );
}
