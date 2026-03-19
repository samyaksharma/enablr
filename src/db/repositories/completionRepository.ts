import * as SQLite from 'expo-sqlite';
import { Completion } from '../../types';

interface CompletionRow {
  id: string;
  habit_id: string;
  completed_at: string;
  xp_earned: number;
  synced: number;
  local_version: number;
  client_id: string;
}

function rowToCompletion(row: CompletionRow): Completion {
  return {
    id: row.id,
    habitId: row.habit_id,
    completedAt: row.completed_at,
    xpEarned: row.xp_earned,
    synced: row.synced === 1,
    localVersion: row.local_version,
    clientId: row.client_id,
  };
}

export const completionRepository = {
  async create(
    db: SQLite.SQLiteDatabase,
    completion: { id: string; habitId: string; xpEarned: number; clientId: string }
  ): Promise<Completion> {
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO completions (id, habit_id, completed_at, xp_earned, synced, local_version, client_id) VALUES (?, ?, ?, ?, 0, 1, ?)',
      [completion.id, completion.habitId, now, completion.xpEarned, completion.clientId]
    );
    return {
      ...completion,
      completedAt: now,
      synced: false,
      localVersion: 1,
    };
  },

  async getByHabitId(db: SQLite.SQLiteDatabase, habitId: string): Promise<Completion[]> {
    const rows = await db.getAllAsync<CompletionRow>(
      'SELECT * FROM completions WHERE habit_id = ? ORDER BY completed_at DESC',
      [habitId]
    );
    return rows.map(rowToCompletion);
  },

  async getByUserId(db: SQLite.SQLiteDatabase, userId: string): Promise<Completion[]> {
    const rows = await db.getAllAsync<CompletionRow>(
      `SELECT c.* FROM completions c
       JOIN habits h ON c.habit_id = h.id
       WHERE h.user_id = ?
       ORDER BY c.completed_at DESC`,
      [userId]
    );
    return rows.map(rowToCompletion);
  },

  async getTodayByHabitId(db: SQLite.SQLiteDatabase, habitId: string): Promise<Completion | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const row = await db.getFirstAsync<CompletionRow>(
      'SELECT * FROM completions WHERE habit_id = ? AND completed_at >= ? AND completed_at < ?',
      [habitId, today.toISOString(), tomorrow.toISOString()]
    );
    return row ? rowToCompletion(row) : null;
  },

  async getCompletionDatesForHabit(db: SQLite.SQLiteDatabase, habitId: string): Promise<string[]> {
    const rows = await db.getAllAsync<{ completed_at: string }>(
      'SELECT completed_at FROM completions WHERE habit_id = ? ORDER BY completed_at DESC',
      [habitId]
    );
    return rows.map((r) => r.completed_at);
  },

  async getUnsynced(db: SQLite.SQLiteDatabase): Promise<Completion[]> {
    const rows = await db.getAllAsync<CompletionRow>(
      'SELECT * FROM completions WHERE synced = 0'
    );
    return rows.map(rowToCompletion);
  },

  async markSynced(db: SQLite.SQLiteDatabase, completionId: string): Promise<void> {
    await db.runAsync('UPDATE completions SET synced = 1 WHERE id = ?', [completionId]);
  },

  async getTodayCompletionCount(db: SQLite.SQLiteDatabase, userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM completions c
       JOIN habits h ON c.habit_id = h.id
       WHERE h.user_id = ? AND c.completed_at >= ? AND c.completed_at < ?`,
      [userId, today.toISOString(), tomorrow.toISOString()]
    );
    return result?.count ?? 0;
  },

  async getTotalCount(db: SQLite.SQLiteDatabase, userId: string): Promise<number> {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM completions c
       JOIN habits h ON c.habit_id = h.id
       WHERE h.user_id = ?`,
      [userId]
    );
    return result?.count ?? 0;
  },
};
