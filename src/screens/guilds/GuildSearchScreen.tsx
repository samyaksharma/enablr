import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyNote, GuildEmblem } from '../../components/guild/GuildBits';
import { useThemeStore } from '../../stores/themeStore';
import { useSyncStore } from '../../stores/syncStore';
import { GuildStackParamList } from '../../navigation/GuildStack';
import { shared } from './shared';
import { spacing } from '../../constants/theme';

export function GuildSearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<GuildStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const isConnected = useSyncStore((s) => s.isConnected);
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  // Wait for a pause in typing before asking the server
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const results = useQuery(api.guilds.search, { text: query });

  return (
    <View style={[shared.screen, { backgroundColor: colors.background }]}>
      <View style={styles.search}>
        <Input
          placeholder="Search guilds by name"
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          returnKeyType="search"
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      <FlatList
        data={results ?? []}
        keyExtractor={(guild) => guild._id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !isConnected ? (
            <EmptyNote
              title="You're offline"
              body="Searching for guilds needs a connection. Your own guilds are still on the Guilds tab."
            />
          ) : results === undefined ? (
            <EmptyNote title="Searching…" />
          ) : (
            <EmptyNote
              title={query ? 'No guilds by that name' : 'No guilds yet'}
              body={
                query
                  ? 'Check the spelling, or found a guild of your own.'
                  : 'Be the first: go back and found a guild.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Guild', { guildId: item._id })}
          >
            <Card style={shared.cardGap}>
              <View style={shared.row}>
                <GuildEmblem url={item.emblemUrl} name={item.name} size={48} />
                <View style={styles.text}>
                  <Text style={[shared.bodyBold, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[shared.caption, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={[shared.small, { color: colors.textMuted }]}>
                    {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  text: {
    flex: 1,
    marginLeft: spacing.md,
  },
});
