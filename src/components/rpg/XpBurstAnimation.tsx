import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { typography } from '../../constants/theme';

interface XpBurstAnimationProps {
  amount: number;
  visible: boolean;
}

export function XpBurstAnimation({ amount, visible }: XpBurstAnimationProps) {
  const colors = useThemeStore((s) => s.colors);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    if (visible && amount > 0) {
      translateY.value = 0;
      opacity.value = 0;
      scale.value = 0.5;

      scale.value = withSequence(
        withTiming(1.3, { duration: 200, easing: Easing.out(Easing.back(2)) }),
        withTiming(1, { duration: 150 })
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 800 }),
        withTiming(0, { duration: 300 })
      );
      translateY.value = withTiming(-80, {
        duration: 1300,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [visible, amount]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={[styles.text, { color: colors.gold }]}>+{amount} XP</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 9999,
  },
  text: {
    ...typography.h1,
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
