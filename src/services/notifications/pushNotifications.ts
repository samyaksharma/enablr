import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { convex } from '../convex/convexClient';
import { api } from '../../../convex/_generated/api';
import { requestSync } from '../sync/syncTrigger';

export const pushNotifications = {
  async registerForPushNotifications(): Promise<string | null> {
    // Android 13+ only shows the permission prompt once a channel exists
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Local reminders work everywhere; push tokens need a physical device
    if (!Device.isDevice) {
      return null;
    }

    try {
      // Needs an EAS project ID (app.json extra.eas.projectId) and, on Android,
      // FCM credentials uploaded to that project.
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return null;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenData.data;

      // Store token in Convex
      await convex.mutation(api.users.updatePushToken, {
        pushToken: token,
      });

      return token;
    } catch {
      // Push is optional: without it the app still works and local reminders still fire
      return null;
    }
  },

  setupNotificationListeners() {
    const responseListener = Notifications.addNotificationResponseReceivedListener(() => {
      // Tapping a notification opens the app; pull anything new straight away
      requestSync();
    });

    return () => {
      responseListener.remove();
    };
  },
};
