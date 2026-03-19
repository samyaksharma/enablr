import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { convexHttpClient } from '../convex/convexClient';
import { api } from '../../../convex/_generated/api';

export const pushNotifications = {
  async registerForPushNotifications(userId: string): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
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

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      // Store token in Convex
      await convexHttpClient.mutation(api.users.updatePushToken, {
        tokenIdentifier: userId,
        pushToken: token,
      });

      return token;
    } catch (e) {
      // Push tokens require FCM setup on Android — skip if not configured
      console.log('Push token registration skipped:', e);
      return null;
    }
  },

  setupNotificationListeners() {
    const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
      // Handle foreground notifications
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      // Could navigate to the relevant habit
      console.log('Notification tapped:', data);
    });

    return () => {
      receivedListener.remove();
      responseListener.remove();
    };
  },
};
