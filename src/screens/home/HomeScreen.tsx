import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { useSyncStore } from '../../stores/syncStore';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { GuildEmblem } from '../../components/guild/GuildBits';
import { GuildTaskRow, isDueToday } from '../../components/guild/GuildTaskRow';
import { submitGuildTask } from '../../services/guild/submitTask';
import { toDayKey } from '../../utils/schedule';

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const colors = useThemeStore((s) => s.colors);
  const user = useAuthStore((s) => s.user);
  const { habits, todaysHabits, isLoading, loadHabits } = useHabitStore();
  const { showLevelUp, newLevelReached, dismissLevelUp, recentBadge, dismissBadge } =
    useProgressionStore();

  const syncNotice = useSyncStore((s) => s.notice);
  const clearSyncNotice = useSyncStore((s) => s.clearNotice);

  // Guild data comes from the server, with the last result cached for offline
  const today = toDayKey(new Date());
  const myGuilds = useCachedQuery('guilds.myGuilds', api.guilds.myGuilds, {});
  const guildTaskGroups = useCachedQuery(`guildTasks.mine:${today}`, api.guildTasks.mine, { today });

  // Open guild tasks: due today and not yet approved
  const guildGroups = useMemo(
    () =>
      (guildTaskGroups ?? [])
        .map((group) => ({
          ...group,
          tasks: group.tasks
            .filter((task) => {
              const status = task.mine?.status ?? null;
              return isDueToday(task) && status !== 'approved' && status !== 'revoked';
            })
            .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)),
        }))
        .filter((group) => group.tasks.length > 0),
    [guildTaskGroups]
  );

  // Ask for notification permission after the first habit or the first guild
  useNotificationPermission((myGuilds?.guilds.length ?? 0) > 0);

  const openGuild = (guildId: Id<'guilds'>) => {
    navigation.getParent()?.navigate('Guilds', {
      screen: 'Guild',
      params: { guildId },
      initial: false,
    });
  };

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

  // Habits that exist but aren't due today still need to be visible and editable
  const upcomingHabits = useMemo(() => {
    const todaysIds = new Set(todaysHabits.map((h) => h.id));
    return habits.filter((h) => !todaysIds.has(h.id));
  }, [habits, todaysHabits]);

  const isEmpty = habits.length === 0 && guildGroups.length === 0 && !isLoading;

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
          {todaysHabits.length === 0 && (
            <Text style={[styles.nothingToday, { color: colors.textSecondary }]}>
              {habits.length === 0
                ? 'No habits of your own yet. Tap + to add one.'
                : 'No habits due today. Rest up, adventurer.'}
            </Text>
          )}
          <HabitList
            habits={todaysHabits}
            upcoming={upcomingHabits}
            onHabitPress={(habit) => navigation.navigate('EditHabit', { habitId: habit.id })}
            onComplete={handleComplete}
          />

          {guildGroups.length > 0 && (
            <View style={styles.guildSection}>
              <Text style={[styles.guildSectionTitle, { color: colors.textSecondary }]}>
                Guild Tasks
              </Text>
              {guildGroups.map((group) => (
                <View key={group.guildId}>
                  <TouchableOpacity
                    style={styles.guildHeader}
                    onPress={() => openGuild(group.guildId)}
                    activeOpacity={0.7}
                  >
                    <GuildEmblem url={group.emblemUrl} name={group.guildName} size={28} />
                    <Text style={[styles.guildName, { color: colors.text }]} numberOfLines={1}>
                      {group.guildName}
                    </Text>
                  </TouchableOpacity>
                  {group.tasks.map((task) => (
                    <GuildTaskRow key={task._id} task={task} onComplete={submitGuildTask} />
                  ))}
                </View>
              ))}
            </View>
          )}
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

      {/* A habit archived on another device, etc. */}
      {syncNotice && (
        <Toast
          message={syncNotice}
          visible={!!syncNotice}
          onDismiss={clearSyncNotice}
          duration={5000}
          type="info"
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
  nothingToday: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  guildSection: {
    paddingBottom: spacing.xxxl + spacing.xxl,
  },
  guildSectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  guildHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  guildName: {
    ...typography.bodyBold,
    flex: 1,
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
