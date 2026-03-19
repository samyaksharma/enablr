import * as Notifications from 'expo-notifications';
import { Habit } from '../../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const localNotifications = {
  async scheduleHabitReminder(habit: Habit): Promise<string | null> {
    if (!habit.scheduledTime) return null;

    const [hours, minutes] = habit.scheduledTime.split(':').map(Number);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Enablr',
        body: `Time to ${habit.name} \u2014 keep your streak going.`,
        data: { habitId: habit.id },
      },
      trigger: {
        type: 'daily' as any,
        hour: hours,
        minute: minutes,
      },
    });

    return identifier;
  },

  async cancelHabitReminder(habitId: string): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  },

  async rescheduleAllReminders(habits: Habit[]): Promise<void> {
    // Cancel all existing
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Reschedule active habits with times
    for (const habit of habits) {
      if (!habit.archived && habit.scheduledTime) {
        await this.scheduleHabitReminder(habit);
      }
    }
  },
};
