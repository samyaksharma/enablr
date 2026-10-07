import * as SQLite from 'expo-sqlite';
import { Habit, Recurrence, HabitCategory, Difficulty } from '../../types';

interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  recurrence: string;
  category: string;
  difficulty: string;
  scheduled_time: string | null;
  reminder_enabled: number;
  archived: number;
  created_at: string;
  updated_at: string;
  client_id: string;
  local_version: number;
  synced: number;
}

function rowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    recurrence: JSON.parse(row.recurrence) as Recurrence,
    category: row.category as HabitCategory,
    difficulty: row.difficulty as Difficulty,
    scheduledTime: row.scheduled_time ?? undefined,
    reminderEnabled: row.reminder_enabled === 1,
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id,
    localVersion: row.local_version,
    synced: row.synced === 1,
  };
}

export type HabitUpdates = Partial<
  Pick<Habit, 'name' | 'description' | 'recurrence' | 'category' | 'difficulty' | 'reminderEnabled'>
> & {
  // null clears the scheduled time
  scheduledTime?: string | null;
};

export const habitRepository = {
  async create(
    db: SQLite.SQLiteDatabase,
    habit: Omit<
      Habit,
      'archived' | 'createdAt' | 'updatedAt' | 'localVersion' | 'synced' | 'reminderEnabled'
    > & { reminderEnabled?: boolean }
  ): Promise<Habit> {
    const now = new Date().toISOString();
    const reminderEnabled = habit.reminderEnabled ?? true;
    await db.runAsync(
      `INSERT INTO habits (id, user_id, name, description, recurrence, category, difficulty, scheduled_time, reminder_enabled, archived, created_at, updated_at, client_id, local_version, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, 0)`,
      [
        habit.id,
        habit.userId,
        habit.name,
        habit.description,
        JSON.stringify(habit.recurrence),
        habit.category,
        habit.difficulty,
        habit.scheduledTime ?? null,
        reminderEnabled ? 1 : 0,
        now,
        now,
        habit.clientId,
      ]
    );
    return {
      ...habit,
      reminderEnabled,
      archived: false,
      createdAt: now,
      updatedAt: now,
      localVersion: 1,
      synced: false,
    };
  },

  async update(db: SQLite.SQLiteDatabase, habitId: string, updates: HabitUpdates): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?', 'local_version = local_version + 1', 'synced = 0'];
    const values: (string | number | null)[] = [now];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push('description = ?');
      values.push(updates.description);
    }
    if (updates.recurrence !== undefined) {
      sets.push('recurrence = ?');
      values.push(JSON.stringify(updates.recurrence));
    }
    if (updates.category !== undefined) {
      sets.push('category = ?');
      values.push(updates.category);
    }
    if (updates.difficulty !== undefined) {
      sets.push('difficulty = ?');
      values.push(updates.difficulty);
    }
    if (updates.scheduledTime !== undefined) {
      sets.push('scheduled_time = ?');
      values.push(updates.scheduledTime);
    }
    if (updates.reminderEnabled !== undefined) {
      sets.push('reminder_enabled = ?');
      values.push(updates.reminderEnabled ? 1 : 0);
    }

    values.push(habitId);
    await db.runAsync(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  // Writes a habit exactly as the server has it. Unlike update(), this keeps the
  // server's timestamps and marks the row synced, so it is not pushed back.
  async upsertFromRemote(
    db: SQLite.SQLiteDatabase,
    habit: Omit<Habit, 'synced'>
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO habits (id, user_id, name, description, recurrence, category, difficulty, scheduled_time, reminder_enabled, archived, created_at, updated_at, client_id, local_version, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         recurrence = excluded.recurrence,
         category = excluded.category,
         difficulty = excluded.difficulty,
         scheduled_time = excluded.scheduled_time,
         reminder_enabled = excluded.reminder_enabled,
         archived = excluded.archived,
         updated_at = excluded.updated_at,
         client_id = excluded.client_id,
         local_version = excluded.local_version,
         synced = 1`,
      [
        habit.id,
        habit.userId,
        habit.name,
        habit.description,
        JSON.stringify(habit.recurrence),
        habit.category,
        habit.difficulty,
        habit.scheduledTime ?? null,
        habit.reminderEnabled ? 1 : 0,
        habit.archived ? 1 : 0,
        habit.createdAt,
        habit.updatedAt,
        habit.clientId,
        habit.localVersion,
      ]
    );
  },

  async archive(db: SQLite.SQLiteDatabase, habitId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE habits SET archived = 1, updated_at = ?, local_version = local_version + 1, synced = 0 WHERE id = ?',
      [now, habitId]
    );
  },

  async getActiveByUserId(db: SQLite.SQLiteDatabase, userId: string): Promise<Habit[]> {
    const rows = await db.getAllAsync<HabitRow>(
      'SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY created_at ASC',
      [userId]
    );
    return rows.map(rowToHabit);
  },

  async getById(db: SQLite.SQLiteDatabase, habitId: string): Promise<Habit | null> {
    const row = await db.getFirstAsync<HabitRow>('SELECT * FROM habits WHERE id = ?', [habitId]);
    return row ? rowToHabit(row) : null;
  },

  async getAllByUserId(db: SQLite.SQLiteDatabase, userId: string): Promise<Habit[]> {
    const rows = await db.getAllAsync<HabitRow>(
      'SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC',
      [userId]
    );
    return rows.map(rowToHabit);
  },

  async getUnsynced(db: SQLite.SQLiteDatabase, userId: string): Promise<Habit[]> {
    const rows = await db.getAllAsync<HabitRow>(
      'SELECT * FROM habits WHERE user_id = ? AND synced = 0',
      [userId]
    );
    return rows.map(rowToHabit);
  },

  // Only clears the flag if the row hasn't been edited again since it was read
  async markSynced(db: SQLite.SQLiteDatabase, habitId: string, localVersion: number): Promise<void> {
    await db.runAsync('UPDATE habits SET synced = 1 WHERE id = ? AND local_version = ?', [
      habitId,
      localVersion,
    ]);
  },
};
