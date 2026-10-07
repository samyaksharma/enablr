import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Habit } from '../../types';
import { getNextScheduledDate, isScheduledForDate } from '../../utils/recurrenceUtils';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'default';
// "Every N days" can't be expressed as a repeating trigger, so a batch of dated
// reminders is scheduled and topped up whenever the app is opened.
const INTERVAL_REMINDERS_AHEAD = 8;

export function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

// Returns "HH:mm", or null if the text isn't a valid 24-hour time.
export function normalizeTime(time: string): string | null {
  const parsed = parseTime(time);
  if (!parsed) return null;
  return `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}`;
}

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

function content(habit: Habit): Notifications.NotificationContentInput {
  return {
    title: 'Enablr',
    body: `Time to ${habit.name} — keep your streak going.`,
    data: { habitId: habit.id },
  };
}

async function scheduleHabit(habit: Habit): Promise<void> {
  const time = habit.scheduledTime ? parseTime(habit.scheduledTime) : null;
  if (!time) return;
  const { hour, minute } = time;

  if (habit.recurrence.type === 'daily') {
    await Notifications.scheduleNotificationAsync({
      content: content(habit),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: CHANNEL_ID,
      },
    });
    return;
  }

  if (habit.recurrence.type === 'specific_days') {
    for (const day of habit.recurrence.days ?? []) {
      await Notifications.scheduleNotificationAsync({
        content: content(habit),
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: day + 1, // expo counts from Sunday = 1
          hour,
          minute,
          channelId: CHANNEL_ID,
        },
      });
    }
    return;
  }

  // interval
  const now = new Date();
  const todayAtTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute);
  let cursor: Date | null =
    isScheduledForDate(habit.recurrence, now, habit.createdAt) && todayAtTime > now
      ? now
      : getNextScheduledDate(habit.recurrence, habit.createdAt, now);
  for (let i = 0; i < INTERVAL_REMINDERS_AHEAD && cursor; i++) {
    const at = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), hour, minute);
    await Notifications.scheduleNotificationAsync({
      content: content(habit),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_ID,
      },
    });
    cursor = getNextScheduledDate(habit.recurrence, habit.createdAt, cursor);
  }
}

let running: Promise<void> = Promise.resolve();

export const localNotifications = {
  // Replaces every scheduled habit reminder with a fresh set matching the
  // habits as they are now. Safe to call often; calls run one at a time.
  syncReminders(habits: Habit[]): Promise<void> {
    running = running
      .then(async () => {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;

        await ensureChannel();
        await Notifications.cancelAllScheduledNotificationsAsync();
        for (const habit of habits) {
          if (habit.archived || !habit.reminderEnabled || !habit.scheduledTime) continue;
          await scheduleHabit(habit);
        }
      })
      .catch(() => {
        // Reminders are best-effort; a scheduling failure must never break a habit action
      });
    return running;
  },

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  },
};
