import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { typography, spacing, borderRadius } from '../../constants/theme';

interface LevelUpOverlayProps {
  visible: boolean;
  level: number;
  subtitle?: string;
  onDismiss: () => void;
}

const { width, height } = Dimensions.get('window');

export function LevelUpOverlay({ visible, level, subtitle, onDismiss }: LevelUpOverlayProps) {
  const colors = useThemeStore((s) => s.colors);
  const overlayOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.3);
  const contentOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 300 });
      contentScale.value = withSequence(
        withTiming(1.1, { duration: 400, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 200 })
      );
      contentOpacity.value = withTiming(1, { duration: 300 });
      glowScale.value = withSequence(
        withDelay(200, withTiming(2.5, { duration: 600, easing: Easing.out(Easing.cubic) })),
        withTiming(2, { duration: 400 })
      );

      // Auto-dismiss after 4 seconds
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      contentOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: contentScale.value }],
    opacity: contentOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  if (!visible) return null;

  return (
    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onDismiss}>
      <Animated.View style={[styles.overlay, { backgroundColor: colors.overlay }, overlayStyle]}>
        <Animated.View style={[styles.glow, glowStyle]} />

        <Animated.View style={[styles.content, contentStyle]}>
          <Text style={styles.emoji}>{'\u2B50'}</Text>
          <Text style={[styles.title, { color: colors.gold }]}>LEVEL UP!</Text>
          <Text style={[styles.level, { color: colors.text }]}>Level {level}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle ?? 'Your power grows stronger'}
          </Text>
          <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap to continue</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  content: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emoji: {
    fontSize: 80,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
  },
  level: {
    ...typography.h1,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  tapHint: {
    ...typography.small,
    marginTop: spacing.xxl,
  },
});
