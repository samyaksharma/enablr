import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useThemeStore } from '../../stores/themeStore';
import { borderRadius, spacing, typography } from '../../constants/theme';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  type?: 'success' | 'info' | 'warning' | 'error';
}

export function Toast({
  message,
  visible,
  onDismiss,
  duration = 3000,
  type = 'success',
}: ToastProps) {
  const colors = useThemeStore((s) => s.colors);
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          duration,
          withTiming(0, { duration: 300 }, () => {
            runOnJS(onDismiss)();
          })
        )
      );
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const bgColor =
    type === 'success'
      ? colors.success
      : type === 'warning'
        ? colors.warning
        : type === 'error'
          ? colors.error
          : colors.primary;

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }, animatedStyle]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    zIndex: 9999,
    alignItems: 'center',
  },
  text: {
    ...typography.bodyBold,
    color: '#FFFFFF',
  },
});
