import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useConvexAuth } from 'convex/react';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { CharacterCreationScreen } from '../screens/auth/CharacterCreationScreen';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { authService } from '../services/auth/authService';
import { useProgressionStore } from '../stores/progressionStore';
import { getDatabase } from '../db/database';
import { badgeRepository } from '../db/repositories/badgeRepository';

export function RootNavigator() {
  const colors = useThemeStore((s) => s.colors);
  const { isAuthenticated, isLoading, hasCharacter } = useAuthStore();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexLoading } = useConvexAuth();
  const hasHandledAuth = useRef(false);

  useEffect(() => {
    if (isConvexLoading) return;

    // Prevent re-running if already handled for current auth state
    if (hasHandledAuth.current && isConvexAuthenticated) return;

    if (isConvexAuthenticated) {
      hasHandledAuth.current = true;
      (async () => {
        try {
          const convexUserId = 'convex_user';
          const user = await authService.ensureLocalUser(convexUserId);
          useAuthStore.getState().setConvexUserId(convexUserId);
          useAuthStore.getState().setUser(user);

          // Hydrate progression
          const db = await getDatabase();
          const badges = await badgeRepository.getByUserId(db, user.id);
          useProgressionStore.getState().hydrate(user.xp, user.level, badges);
        } catch {
          useAuthStore.getState().setLoading(false);
        }
      })();
    } else {
      hasHandledAuth.current = false;
      useAuthStore.getState().clearUser();
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

  return <MainTabs />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
