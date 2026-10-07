import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useHabitStore } from '../stores/habitStore';
import { pushNotifications } from '../services/notifications/pushNotifications';
import { localNotifications } from '../services/notifications/localNotifications';

// Asks for notification permission once the user has a reason to want it:
// their first habit or their first guild, whichever comes first.
export function useNotificationPermission(hasGuild: boolean) {
  const userId = useAuthStore((s) => s.user?.id);
  const habitCount = useHabitStore((s) => s.habits.length);
  const requestedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || requestedFor.current === userId) return;
    if (habitCount < 1 && !hasGuild) return;
    requestedFor.current = userId;

    (async () => {
      await pushNotifications.registerForPushNotifications();
      // Permission may have just been granted, so schedule any waiting reminders
      await localNotifications.syncReminders(useHabitStore.getState().habits);
    })();
  }, [habitCount, hasGuild, userId]);
}
