import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { CharacterAvatar } from '../../components/rpg/CharacterAvatar';
import { XpBar } from '../../components/rpg/XpBar';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useThemeStore } from '../../stores/themeStore';
import { getDatabase } from '../../db/database';
import { completionRepository } from '../../db/repositories/completionRepository';
import { spacing, typography } from '../../constants/theme';
import { api } from '../../../convex/_generated/api';
import { useCachedQuery } from '../../hooks/useCachedQuery';
import { GuildEmblem, GuildLevelBar, RoleChip } from '../../components/guild/GuildBits';

export function ProfileScreen() {
  const colors = useThemeStore((s) => s.colors);
  const user = useAuthStore((s) => s.user);
  const { level, xp, badges } = useProgressionStore();
  const [totalCompletions, setTotalCompletions] = useState(0);
  const myGuilds = useCachedQuery('guilds.myGuilds', api.guilds.myGuilds, {});

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      const db = await getDatabase();
      const count = await completionRepository.getTotalCount(db, user.id);
      setTotalCompletions(count);
    }
    loadStats();
  }, [user, xp]);

  if (!user) return null;

  const stats = [
    { label: 'Total XP', value: xp.toLocaleString(), color: colors.gold },
    { label: 'Completions', value: totalCompletions.toString(), color: colors.accent },
    { label: 'Badges', value: badges.length.toString(), color: colors.secondary },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <CharacterAvatar
          characterClass={user.characterClass}
          level={level}
          size="lg"
        />
        <Text style={[styles.characterName, { color: colors.text }]}>
          {user.characterName}
        </Text>
        <Text style={[styles.className, { color: colors.textSecondary }]}>
          {user.characterClass.charAt(0).toUpperCase() + user.characterClass.slice(1)}
        </Text>
      </View>

      <View style={styles.xpSection}>
        <XpBar />
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <Card key={stat.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {myGuilds && myGuilds.guilds.length > 0 ? (
        <View style={styles.guilds}>
          <Text style={[styles.guildsTitle, { color: colors.textSecondary }]}>Guilds</Text>
          {myGuilds.guilds.map((guild) => (
            <Card key={guild._id} style={styles.guildCard}>
              <View style={styles.guildRow}>
                <GuildEmblem url={guild.emblemUrl} name={guild.name} size={40} />
                <View style={styles.guildText}>
                  <Text style={[styles.guildName, { color: colors.text }]} numberOfLines={1}>
                    {guild.name}
                  </Text>
                  <RoleChip name={guild.roleName} color={guild.roleColor} iconUrl={guild.roleIconUrl} />
                </View>
              </View>
              <GuildLevelBar xp={guild.xp} compact />
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xxxl + spacing.xxl,
    paddingBottom: spacing.xl,
  },
  characterName: {
    ...typography.h2,
    marginTop: spacing.lg,
  },
  className: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  xpSection: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h2,
  },
  statLabel: {
    ...typography.small,
    marginTop: spacing.xs,
  },
  guilds: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  guildsTitle: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  guildCard: {
    marginBottom: spacing.md,
  },
  guildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  guildText: {
    flex: 1,
    marginLeft: spacing.md,
    gap: spacing.xs,
  },
  guildName: {
    ...typography.bodyBold,
  },
});
