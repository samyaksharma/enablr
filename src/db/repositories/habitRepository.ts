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
    archived: row.archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clientId: row.client_id,
    localVersion: row.local_version,
    synced: row.synced === 1,
  };
}

export const habitRepository = {
  async create(
    db: SQLite.SQLiteDatabase,
    habit: Omit<Habit, 'archived' | 'createdAt' | 'updatedAt' | 'localVersion' | 'synced'>
  ): Promise<Habit> {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO habits (id, user_id, name, description, recurrence, category, difficulty, scheduled_time, archived, created_at, updated_at, client_id, local_version, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, 0)`,
      [
        habit.id,
        habit.userId,
        habit.name,
        habit.description,
        JSON.stringify(habit.recurrence),
        habit.category,
        habit.difficulty,
        habit.scheduledTime ?? null,
        now,
        now,
        habit.clientId,
      ]
    );
    return {
      ...habit,
      archived: false,
      createdAt: now,
      updatedAt: now,
      localVersion: 1,
      synced: false,
    };
  },

  async update(
    db: SQLite.SQLiteDatabase,
    habitId: string,
    updates: Partial<Pick<Habit, 'name' | 'description' | 'recurrence' | 'category' | 'difficulty' | 'scheduledTime'>>
  ): Promise<void> {
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?', 'local_version = local_version + 1', 'synced = 0'];
    const values: (string | null)[] = [now];

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

    values.push(habitId);
    await db.runAsync(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?`, values);
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

  async markSynced(db: SQLite.SQLiteDatabase, habitId: string): Promise<void> {
    await db.runAsync('UPDATE habits SET synced = 1 WHERE id = ?', [habitId]);
  },
};
