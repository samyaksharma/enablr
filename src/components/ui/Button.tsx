import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useThemeStore } from '../../stores/themeStore';
import { borderRadius, spacing, typography } from '../../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const colors = useThemeStore((s) => s.colors);

  const buttonStyles: StyleProp<ViewStyle> = [
    styles.base,
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    {
      backgroundColor:
        variant === 'primary'
          ? colors.primary
          : variant === 'secondary'
            ? colors.surface
            : 'transparent',
      borderWidth: variant === 'outline' ? 1.5 : 0,
      borderColor: variant === 'outline' ? colors.primary : undefined,
      opacity: disabled ? 0.5 : 1,
    },
    style,
  ];

  const textStyles: StyleProp<TextStyle> = [
    styles.text,
    size === 'sm' && styles.textSm,
    size === 'lg' && styles.textLg,
    {
      color:
        variant === 'primary'
          ? '#FFFFFF'
          : variant === 'outline' || variant === 'ghost'
            ? colors.primary
            : colors.text,
    },
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 36,
  },
  lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    minHeight: 56,
  },
  text: {
    ...typography.bodyBold,
  },
  textSm: {
    ...typography.caption,
    fontWeight: '600',
  },
  textLg: {
    ...typography.h3,
  },
});
