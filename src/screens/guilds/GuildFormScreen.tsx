import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { LIMITS } from '../../../convex/permissions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { GuildEmblem } from '../../components/guild/GuildBits';
import { useThemeStore } from '../../stores/themeStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { PickedMedia, pickSquareImage, uploadToStorage } from '../../services/media/upload';
import { Loading, attempt, shared } from './shared';
import { spacing, typography } from '../../constants/theme';

const EMBLEM_SIZE = 1024;

export function GuildFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const route = useRoute<RouteProp<GuildStackParamList, 'GuildForm'>>();
  const guildId = route.params?.guildId;
  const colors = useThemeStore((s) => s.colors);

  const existing = useQuery(api.guilds.overview, guildId ? { guildId } : 'skip');
  const generateUploadUrl = useMutation(api.guilds.generateUploadUrl);
  const createGuild = useMutation(api.guilds.create);
  const updateGuild = useMutation(api.guilds.update);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emblem, setEmblem] = useState<PickedMedia | null>(null);
  const [loaded, setLoaded] = useState(!guildId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existing && !loaded) {
      setName(existing.name);
      setDescription(existing.description);
      setLoaded(true);
    }
  }, [existing, loaded]);

  if (guildId && !loaded) return <Loading />;

  const chooseEmblem = async () => {
    await attempt(async () => {
      const picked = await pickSquareImage(EMBLEM_SIZE);
      if (picked) setEmblem(picked);
    });
  };

  const save = async () => {
    if (name.trim().length < LIMITS.nameMin) {
      setError(`Give the guild a name of at least ${LIMITS.nameMin} characters.`);
      return;
    }
    if (!description.trim()) {
      setError('Add a description so people know what the guild is about.');
      return;
    }
    setError('');
    setSaving(true);

    let createdId: Id<'guilds'> | undefined;
    const ok = await attempt(async () => {
      let emblemId: Id<'_storage'> | undefined;
      if (emblem) {
        const uploadUrl = await generateUploadUrl({});
        emblemId = (await uploadToStorage(uploadUrl, emblem)) as Id<'_storage'>;
      }
      if (guildId) {
        await updateGuild({ guildId, name, description, emblemId });
      } else {
        createdId = await createGuild({ name, description, emblemId });
      }
    }, guildId ? 'Guild updated.' : 'Your guild is founded.');
    setSaving(false);

    if (!ok) return;
    if (createdId) {
      navigation.replace('Guild', { guildId: createdId });
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScrollView
      style={[shared.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={shared.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity style={styles.emblemPicker} onPress={chooseEmblem} activeOpacity={0.8}>
        {emblem ? (
          <Image source={{ uri: emblem.uri }} style={styles.emblemPreview} />
        ) : (
          <GuildEmblem url={existing?.emblemUrl} name={name || 'Guild'} size={112} />
        )}
        <Text style={[styles.emblemHint, { color: colors.primary }]}>
          {emblem || existing?.emblemUrl ? 'Change emblem' : 'Upload emblem'}
        </Text>
      </TouchableOpacity>

      <Input
        label="Guild Name"
        placeholder="e.g., The Dawn Runners"
        value={name}
        onChangeText={setName}
        maxLength={LIMITS.nameMax}
      />
      <Input
        label="Description"
        placeholder="What is this guild for? Anyone searching can read this."
        value={description}
        onChangeText={setDescription}
        maxLength={LIMITS.descriptionMax}
        multiline
        numberOfLines={4}
        style={{ minHeight: 110, textAlignVertical: 'top' }}
      />
      <Text style={[shared.hint, { color: colors.textMuted }]}>
        {description.length} / {LIMITS.descriptionMax}
      </Text>

      {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}

      <Button
        title={guildId ? 'Save Changes' : 'Found Guild'}
        onPress={save}
        loading={saving}
        size="lg"
      />
      {!guildId ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Guilds are public: anyone can find yours and ask to join. You decide who gets in.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emblemPicker: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  emblemPreview: {
    width: 112,
    height: 112,
    borderRadius: 31,
  },
  emblemHint: {
    ...typography.caption,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  note: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
