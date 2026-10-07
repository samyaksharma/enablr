import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import {
  LIMITS,
  PERMISSIONS,
  PERMISSION_LABELS,
  Permission,
  ROLE_COLORS,
} from '../../../convex/permissions';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { RoleChip } from '../../components/guild/GuildBits';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { PickedMedia, pickSquareImage, uploadToStorage } from '../../services/media/upload';
import { Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

const ICON_SIZE = 256;

export function GuildRoleFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GuildStackParamList, 'GuildRoleForm'>>();
  const { guildId, roleId } = route.params;
  const colors = useThemeStore((s) => s.colors);

  const roles = useQuery(api.guildRoles.list, { guildId });
  const guild = useQuery(api.guilds.overview, { guildId });
  const generateUploadUrl = useMutation(api.guilds.generateUploadUrl);
  const createRole = useMutation(api.guildRoles.create);
  const updateRole = useMutation(api.guildRoles.update);
  const removeRole = useMutation(api.guildRoles.remove);

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(ROLE_COLORS[6]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [icon, setIcon] = useState<PickedMedia | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [loaded, setLoaded] = useState(!roleId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const existing = roleId ? roles?.find((r) => r._id === roleId) : undefined;

  useEffect(() => {
    if (!existing || loaded) return;
    setName(existing.name);
    setColor(existing.color);
    setPermissions(existing.permissions as Permission[]);
    setLoaded(true);
  }, [existing, loaded]);

  if (!loaded || !guild) return <Loading />;

  const myPermissions = (guild.membership?.permissions ?? []) as string[];
  const originalPermissions = (existing?.permissions ?? []) as string[];
  const iconUri = icon?.uri ?? (removeIcon ? null : (existing?.iconUrl ?? null));

  const togglePermission = (permission: Permission) =>
    setPermissions((prev) =>
      prev.includes(permission) ? prev.filter((p) => p !== permission) : [...prev, permission]
    );

  const chooseIcon = () =>
    attempt(async () => {
      const picked = await pickSquareImage(ICON_SIZE);
      if (picked) {
        setIcon(picked);
        setRemoveIcon(false);
      }
    });

  const save = async () => {
    if (!name.trim()) return setError('Give the role a name.');
    setError('');
    setSaving(true);
    const ok = await attempt(async () => {
      let iconId: Id<'_storage'> | undefined;
      if (icon) {
        const uploadUrl = await generateUploadUrl({});
        iconId = (await uploadToStorage(uploadUrl, icon)) as Id<'_storage'>;
      }
      if (roleId) {
        await updateRole({ roleId, name, color, iconId, removeIcon, permissions });
      } else {
        await createRole({ guildId, name, color, iconId, permissions });
      }
    }, roleId ? 'Role updated.' : 'Role created.');
    setSaving(false);
    if (ok) navigation.goBack();
  };

  const confirmDelete = () => {
    if (!roleId || !existing) return;
    Alert.alert(
      `Delete ${existing.name}?`,
      existing.memberCount > 0
        ? `${existing.memberCount} ${existing.memberCount === 1 ? 'member holds' : 'members hold'} this role and will become regular Members.`
        : 'No one holds this role.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (await attempt(() => removeRole({ roleId }), 'Role deleted.')) navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.preview}>
        <RoleChip name={name.trim() || 'Role name'} color={color} iconUrl={iconUri} />
      </View>

      <Input
        label="Role Name"
        placeholder="e.g., Quartermaster"
        value={name}
        onChangeText={setName}
        maxLength={LIMITS.roleNameMax}
      />

      <Text style={[shared.label, { color: colors.textSecondary }]}>Colour</Text>
      <View style={styles.swatches}>
        {ROLE_COLORS.map((swatch) => (
          <TouchableOpacity
            key={swatch}
            onPress={() => setColor(swatch)}
            accessibilityLabel={`Colour ${swatch}`}
            style={[
              styles.swatch,
              { backgroundColor: swatch, borderColor: color === swatch ? colors.text : 'transparent' },
            ]}
          />
        ))}
      </View>

      <Text style={[shared.label, { color: colors.textSecondary }]}>Icon (optional)</Text>
      <View style={[shared.row, { marginBottom: spacing.lg, gap: spacing.md }]}>
        {iconUri ? <Image source={{ uri: iconUri }} style={styles.icon} /> : null}
        <Button title={iconUri ? 'Change' : 'Upload icon'} variant="outline" size="sm" onPress={chooseIcon} />
        {iconUri ? (
          <Button
            title="Remove"
            variant="ghost"
            size="sm"
            onPress={() => {
              setIcon(null);
              setRemoveIcon(true);
            }}
          />
        ) : null}
      </View>

      <Text style={[shared.label, { color: colors.textSecondary }]}>Permissions</Text>
      <Card style={{ marginBottom: spacing.lg }}>
        {PERMISSIONS.map((permission, index) => {
          // You can't hand out a permission you don't hold yourself
          const locked =
            !myPermissions.includes(permission) && !originalPermissions.includes(permission);
          return (
            <TouchableOpacity
              key={permission}
              activeOpacity={0.8}
              disabled={locked}
              onPress={() => togglePermission(permission)}
              style={[shared.rowBetween, index > 0 && { marginTop: spacing.md }]}
            >
              <Text
                style={[shared.body, { color: locked ? colors.textMuted : colors.text, flex: 1 }]}
              >
                {PERMISSION_LABELS[permission]}
              </Text>
              <Switch
                value={permissions.includes(permission)}
                onValueChange={() => togglePermission(permission)}
                disabled={locked}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </TouchableOpacity>
          );
        })}
      </Card>
      <Text style={[shared.hint, { color: colors.textMuted }]}>
        Every role can complete tasks. Transferring or deleting the guild stays with the Owner.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button title={roleId ? 'Save Changes' : 'Create Role'} onPress={save} loading={saving} size="lg" />
      {existing?.canDelete ? (
        <Button
          title="Delete Role"
          variant="ghost"
          textStyle={{ color: colors.error }}
          onPress={confirmDelete}
          style={{ marginTop: spacing.md }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  error: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
});
