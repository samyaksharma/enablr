import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { authService } from '../../services/auth/authService';
import { CharacterClass } from '../../types';
import { spacing, typography, borderRadius } from '../../constants/theme';

const CHARACTER_CLASSES = [
  {
    type: CharacterClass.Warrior,
    name: 'Warrior',
    emoji: '\u2694\uFE0F',
    description: 'Strong and disciplined',
    color: '#FF6B6B',
  },
  {
    type: CharacterClass.Mage,
    name: 'Mage',
    emoji: '\uD83E\uDDD9',
    description: 'Wise and focused',
    color: '#7C5CFC',
  },
  {
    type: CharacterClass.Rogue,
    name: 'Rogue',
    emoji: '\uD83D\uDDE1\uFE0F',
    description: 'Swift and adaptable',
    color: '#4ECDC4',
  },
];

export function CharacterCreationScreen() {
  const colors = useThemeStore((s) => s.colors);
  const user = useAuthStore((s) => s.user);
  const [characterName, setCharacterName] = useState('');
  const [selectedClass, setSelectedClass] = useState<CharacterClass>(CharacterClass.Warrior);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!characterName.trim()) {
      setError('Give your character a name');
      return;
    }
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await authService.updateCharacter(user.id, characterName.trim(), selectedClass);
    } catch {
      setError('Failed to create character. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Create Your Character</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Who will embark on this quest?
      </Text>

      <Input
        label="Character Name"
        placeholder="Enter a name for your hero"
        value={characterName}
        onChangeText={setCharacterName}
        containerStyle={{ marginTop: spacing.xxl }}
      />

      <Text style={[styles.classLabel, { color: colors.textSecondary }]}>Choose Your Class</Text>

      <View style={styles.classGrid}>
        {CHARACTER_CLASSES.map((cls) => {
          const isSelected = selectedClass === cls.type;
          return (
            <TouchableOpacity
              key={cls.type}
              style={[
                styles.classCard,
                {
                  backgroundColor: isSelected ? cls.color + '20' : colors.surface,
                  borderColor: isSelected ? cls.color : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedClass(cls.type)}
              activeOpacity={0.7}
            >
              <Text style={styles.classEmoji}>{cls.emoji}</Text>
              <Text style={[styles.className, { color: isSelected ? cls.color : colors.text }]}>
                {cls.name}
              </Text>
              <Text style={[styles.classDesc, { color: colors.textSecondary }]}>
                {cls.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      ) : null}

      <Button
        title="Begin Your Quest"
        onPress={handleCreate}
        loading={loading}
        size="lg"
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xxxl * 2,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  classLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  classGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  classCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  classEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  className: {
    ...typography.bodyBold,
  },
  classDesc: {
    ...typography.small,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
