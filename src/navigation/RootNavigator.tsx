import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useConvexAuth } from 'convex/react';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { GuildFeedback } from '../components/guild/GuildFeedback';
import { CharacterCreationScreen } from '../screens/auth/CharacterCreationScreen';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { authService } from '../services/auth/authService';
import { useProgressionStore } from '../stores/progressionStore';
import { useSyncStore } from '../stores/syncStore';
import { getDatabase } from '../db/database';
import { badgeRepository } from '../db/repositories/badgeRepository';
import { convex } from '../services/convex/convexClient';
import { syncService } from '../services/sync/syncService';
import { api } from '../../convex/_generated/api';

export function RootNavigator() {
  const colors = useThemeStore((s) => s.colors);
  const { isAuthenticated, isLoading, hasCharacter } = useAuthStore();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const hasHandledAuth = useRef(false);

  useEffect(() => {
    useSyncStore.getState().setSessionReady(isConvexAuthenticated && !isConvexLoading);
    if (isConvexLoading) return;

    // Prevent re-running if already handled for current auth state
    if (hasHandledAuth.current && isConvexAuthenticated) return;

    if (isConvexAuthenticated) {
      hasHandledAuth.current = true;
      (async () => {
        try {
          // The account ID comes from the server session, so each account
          // gets its own local rows.
          const account = await convex.query(api.users.currentUser, {});
          if (!account) throw new Error('No account for this session');

          const user = await authService.ensureLocalUser({
            id: account._id,
            name: account.name,
            email: account.email,
            characterName: account.characterName,
            characterClass: account.characterClass,
            xp: account.xp,
          });
          useAuthStore.getState().setConvexUserId(account._id);
          useAuthStore.getState().setUser(user);

          // Hydrate progression
          const db = await getDatabase();
          const badges = await badgeRepository.getByUserId(db, user.id);
          useProgressionStore.getState().hydrate(user.xp, user.level, badges);

          syncService.runSync();
        } catch {
          hasHandledAuth.current = false;
          useAuthStore.getState().setLoading(false);
        }
      })();
    } else {
      hasHandledAuth.current = false;
      authService.clearLocalSession();
    }
  }, [isConvexAuthenticated, isConvexLoading]);

  if (isConvexLoading || isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  if (!hasCharacter) {
    return <CharacterCreationScreen />;
  }

  return (
    <>
      <MainTabs />
      <GuildFeedback />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
