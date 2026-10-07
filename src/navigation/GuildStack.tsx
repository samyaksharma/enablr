import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Id } from '../../convex/_generated/dataModel';
import { GuildsScreen } from '../screens/guilds/GuildsScreen';
import { GuildSearchScreen } from '../screens/guilds/GuildSearchScreen';
import { GuildFormScreen } from '../screens/guilds/GuildFormScreen';
import { GuildScreen } from '../screens/guilds/GuildScreen';
import { GuildTaskFormScreen } from '../screens/guilds/GuildTaskFormScreen';
import { GuildRolesScreen } from '../screens/guilds/GuildRolesScreen';
import { GuildRoleFormScreen } from '../screens/guilds/GuildRoleFormScreen';
import { GuildMemberScreen } from '../screens/guilds/GuildMemberScreen';
import { useThemeStore } from '../stores/themeStore';

export type GuildStackParamList = {
  GuildsMain: undefined;
  GuildSearch: undefined;
  GuildForm: { guildId?: Id<'guilds'> };
  Guild: { guildId: Id<'guilds'> };
  GuildTaskForm: { guildId: Id<'guilds'>; taskId?: Id<'guildTasks'> };
  GuildRoles: { guildId: Id<'guilds'> };
  GuildRoleForm: { guildId: Id<'guilds'>; roleId?: Id<'guildRoles'> };
  GuildMember: { guildId: Id<'guilds'>; userId: Id<'users'> };
};

const Stack = createNativeStackNavigator<GuildStackParamList>();

export function GuildStackNavigator() {
  const colors = useThemeStore((s) => s.colors);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="GuildsMain" component={GuildsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GuildSearch" component={GuildSearchScreen} options={{ title: 'Find a Guild' }} />
      <Stack.Screen
        name="GuildForm"
        component={GuildFormScreen}
        options={({ route }) => ({ title: route.params?.guildId ? 'Edit Guild' : 'New Guild' })}
      />
      <Stack.Screen name="Guild" component={GuildScreen} options={{ title: '' }} />
      <Stack.Screen
        name="GuildTaskForm"
        component={GuildTaskFormScreen}
        options={({ route }) => ({ title: route.params.taskId ? 'Edit Task' : 'New Task' })}
      />
      <Stack.Screen name="GuildRoles" component={GuildRolesScreen} options={{ title: 'Roles' }} />
      <Stack.Screen
        name="GuildRoleForm"
        component={GuildRoleFormScreen}
        options={({ route }) => ({ title: route.params.roleId ? 'Edit Role' : 'New Role' })}
      />
      <Stack.Screen name="GuildMember" component={GuildMemberScreen} options={{ title: 'Member' }} />
    </Stack.Navigator>
  );
}
