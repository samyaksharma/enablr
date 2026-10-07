import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/home/HomeScreen';
import { CreateHabitScreen } from '../screens/habits/CreateHabitScreen';
import { EditHabitScreen } from '../screens/habits/EditHabitScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BadgesScreen } from '../screens/badges/BadgesScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { GuildStackNavigator } from './GuildStack';
import { useThemeStore } from '../stores/themeStore';
import { spacing } from '../constants/theme';

export type HomeStackParamList = {
  HomeMain: undefined;
  CreateHabit: undefined;
  EditHabit: { habitId: string };
};

const HomeStack = createNativeStackNavigator<HomeStackParamList>();

function HomeStackNavigator() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <HomeStack.Screen
        name="CreateHabit"
        component={CreateHabitScreen}
        options={{ title: 'New Habit' }}
      />
      <HomeStack.Screen
        name="EditHabit"
        component={EditHabitScreen}
        options={{ title: 'Edit Habit' }}
      />
    </HomeStack.Navigator>
  );
}

export type MainTabParamList = {
  Home: undefined;
  Guilds: undefined;
  Badges: undefined;
  Profile: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused, color }: { label: string; focused: boolean; color: string }) {
  const icons: Record<string, string> = {
    Home: '\u2694\uFE0F',
    Guilds: '\uD83D\uDEA9',
    Badges: '\uD83C\uDFC5',
    Profile: '\uD83E\uDDD9',
    Settings: '\u2699\uFE0F',
  };
  return <Text style={{ fontSize: focused ? 24 : 20 }}>{icons[label] ?? '\u2B50'}</Text>;
}

export function MainTabs() {
  const colors = useThemeStore((s) => s.colors);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
          height: 60 + Math.max(insets.bottom, spacing.xs),
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarIcon: ({ focused, color }) => (
          <TabIcon label={route.name} focused={focused} color={color} />
        ),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: spacing.xs,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackNavigator} />
      <Tab.Screen name="Guilds" component={GuildStackNavigator} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
