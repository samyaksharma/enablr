import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../stores/authStore';
import { useHabitStore } from '../stores/habitStore';
import { pushNotifications } from '../services/notifications/pushNotifications';

export function useNotificationPermission() {
  const userId = useAuthStore((s) => s.user?.id);
  const habitCount = useHabitStore((s) => s.habits.length);
  const hasRequested = useRef(false);

  useEffect(() => {
    // Request permission after first habit is created
    if (habitCount >= 1 && !hasRequested.current && userId) {
      hasRequested.current = true;

      (async () => {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await pushNotifications.registerForPushNotifications(userId);
        }
      })();
    }
  }, [habitCount, userId]);
}
