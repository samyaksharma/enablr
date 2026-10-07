export const colors = {
  dark: {
    background: '#0D0D1A',
    surface: '#1A1A2E',
    surfaceElevated: '#252540',
    primary: '#7C5CFC',
    primaryLight: '#9B82FC',
    secondary: '#FF6B6B',
    accent: '#4ECDC4',
    gold: '#FFD700',
    text: '#FFFFFF',
    textSecondary: '#A0A0B8',
    textMuted: '#6B6B80',
    border: '#2A2A45',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    xpBar: '#7C5CFC',
    xpBarBackground: '#2A2A45',
    cardBackground: '#1A1A2E',
    tabBar: '#0D0D1A',
    tabBarActive: '#7C5CFC',
    tabBarInactive: '#6B6B80',
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  light: {
    background: '#F5F5FA',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    primary: '#6C4CE6',
    primaryLight: '#8B6FE6',
    secondary: '#E85555',
    accent: '#3DBDB5',
    gold: '#E6C200',
    text: '#1A1A2E',
    textSecondary: '#6B6B80',
    textMuted: '#A0A0B8',
    border: '#E0E0EA',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    xpBar: '#6C4CE6',
    xpBarBackground: '#E0E0EA',
    cardBackground: '#FFFFFF',
    tabBar: '#FFFFFF',
    tabBarActive: '#6C4CE6',
    tabBarInactive: '#A0A0B8',
    overlay: 'rgba(0, 0, 0, 0.4)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof colors.dark]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
} as const;
