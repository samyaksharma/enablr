import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HabitList } from '../../components/habits/HabitList';
import { XpBar } from '../../components/rpg/XpBar';
import { XpBurstAnimation } from '../../components/rpg/XpBurstAnimation';
import { LevelUpOverlay } from '../../components/rpg/LevelUpOverlay';
import { Toast } from '../../components/ui/Toast';
import { useHabitStore } from '../../stores/habitStore';
import { useAuthStore } from '../../stores/authStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useThemeStore } from '../../stores/themeStore';
import { spacing, typography, borderRadius } from '../../constants/theme';
import { HomeStackParamList } from '../../navigation/MainTabs';
import { BADGE_DEFINITIONS } from '../../constants/rpg';
import { useNotificationPermission } from '../../hooks/useNotificationPermission';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const user = useAuthStore((s) => s.user);
  const { todaysHabits, isLoading, loadHabits } = useHabitStore();
  const { showLevelUp, newLevelReached, dismissLevelUp, recentBadge, dismissBadge } =
    useProgressionStore();

  // Request notification permission after first habit
  useNotificationPermission();

  const [xpBurst, setXpBurst] = useState<{ amount: number; visible: boolean }>({
    amount: 0,
    visible: false,
  });

  useEffect(() => {
    loadHabits();
  }, []);

  const handleComplete = useCallback((xpEarned: number) => {
    setXpBurst({ amount: xpEarned, visible: true });
    setTimeout(() => setXpBurst((prev) => ({ ...prev, visible: false })), 1500);
  }, []);

  const isEmpty = todaysHabits.length === 0 && !isLoading;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            Welcome back,
          </Text>
          <Text style={[styles.characterName, { color: colors.text }]}>
            {user?.characterName || 'Adventurer'}
          </Text>
        </View>
        <XpBar compact />
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{'\uD83E\uDDD9'}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            What shall we conquer today?
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Create your first habit to begin your quest
          </Text>
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('CreateHabit')}
            activeOpacity={0.7}
          >
            <Text style={styles.createButtonText}>Create First Habit</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadHabits} tintColor={colors.primary} />
          }
        >
          <HabitList
            habits={todaysHabits}
            onHabitPress={(habit) => navigation.navigate('EditHabit', { habitId: habit.id })}
            onComplete={handleComplete}
          />
        </ScrollView>
      )}

      {/* FAB */}
      {!isEmpty && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('CreateHabit')}
          activeOpacity={0.8}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* XP Burst Animation */}
      <XpBurstAnimation amount={xpBurst.amount} visible={xpBurst.visible} />

      {/* Level Up Overlay */}
      <LevelUpOverlay
        visible={showLevelUp}
        level={newLevelReached}
        onDismiss={dismissLevelUp}
      />

      {/* Badge Toast */}
      {recentBadge && (
        <Toast
          message={`Badge Unlocked: ${BADGE_DEFINITIONS.find((b) => b.type === recentBadge.badgeType)?.name ?? 'Unknown'}!`}
          visible={!!recentBadge}
          onDismiss={dismissBadge}
          type="success"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl + spacing.xl,
    paddingBottom: spacing.lg,
  },
  greeting: {
    ...typography.caption,
  },
  characterName: {
    ...typography.h2,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.h2,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  createButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: borderRadius.lg,
  },
  createButtonText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
});
