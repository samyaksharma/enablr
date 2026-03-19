import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ConvexAuthProvider } from '@convex-dev/auth/react';
import * as SecureStore from 'expo-secure-store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useThemeStore } from './src/stores/themeStore';
import { connectivityMonitor } from './src/services/network/connectivityMonitor';
import { pushNotifications } from './src/services/notifications/pushNotifications';
import { getDatabase } from './src/db/database';
import { convex } from './src/services/convex/convexClient';

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export default function App() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    // Initialize database on app start
    getDatabase();

    // Start connectivity monitoring
    connectivityMonitor.start();
    const stopPeriodicSync = connectivityMonitor.startPeriodicSync();

    // Setup notification listeners
    const cleanupNotifications = pushNotifications.setupNotificationListeners();

    return () => {
      connectivityMonitor.stop();
      stopPeriodicSync();
      cleanupNotifications();
    };
  }, []);

  return (
    <ConvexAuthProvider client={convex} storage={secureStorage}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <NavigationContainer>
          <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
          <RootNavigator />
          </NavigationContainer>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ConvexAuthProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
