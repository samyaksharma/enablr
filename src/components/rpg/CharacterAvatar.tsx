import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CharacterClass } from '../../types';
import { useThemeStore } from '../../stores/themeStore';
import { borderRadius, spacing, typography } from '../../constants/theme';

interface CharacterAvatarProps {
  characterClass: CharacterClass;
  level: number;
  size?: 'sm' | 'md' | 'lg';
}

const CLASS_CONFIG: Record<CharacterClass, { emoji: string; color: string }> = {
  [CharacterClass.Warrior]: { emoji: '\u2694\uFE0F', color: '#FF6B6B' },
  [CharacterClass.Mage]: { emoji: '\uD83E\uDDD9', color: '#7C5CFC' },
  [CharacterClass.Rogue]: { emoji: '\uD83D\uDDE1\uFE0F', color: '#4ECDC4' },
};

const SIZES = {
  sm: { container: 48, emoji: 24, badge: 18, badgeText: 10 },
  md: { container: 80, emoji: 40, badge: 28, badgeText: 12 },
  lg: { container: 120, emoji: 60, badge: 36, badgeText: 16 },
};

export function CharacterAvatar({ characterClass, level, size = 'md' }: CharacterAvatarProps) {
  const colors = useThemeStore((s) => s.colors);
  const config = CLASS_CONFIG[characterClass];
  const dims = SIZES[size];

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            width: dims.container,
            height: dims.container,
            borderRadius: dims.container / 2,
            backgroundColor: config.color + '20',
            borderColor: config.color,
          },
        ]}
      >
        <Text style={{ fontSize: dims.emoji }}>{config.emoji}</Text>
      </View>
      <View
        style={[
          styles.levelBadge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
            backgroundColor: colors.gold,
          },
        ]}
      >
        <Text style={[styles.levelText, { fontSize: dims.badgeText }]}>{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    color: '#000000',
    fontWeight: '800',
  },
});
