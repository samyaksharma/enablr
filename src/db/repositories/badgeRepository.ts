import * as SQLite from 'expo-sqlite';
import { Badge, BadgeType } from '../../types';

interface BadgeRow {
  id: string;
  user_id: string;
  badge_type: string;
  earned_at: string;
  synced: number;
}

function rowToBadge(row: BadgeRow): Badge {
  return {
    id: row.id,
    userId: row.user_id,
    badgeType: row.badge_type as BadgeType,
    earnedAt: row.earned_at,
    synced: row.synced === 1,
  };
}

export const badgeRepository = {
  async create(
    db: SQLite.SQLiteDatabase,
    badge: { id: string; userId: string; badgeType: BadgeType }
  ): Promise<Badge> {
    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT INTO badges (id, user_id, badge_type, earned_at, synced) VALUES (?, ?, ?, ?, 0)',
      [badge.id, badge.userId, badge.badgeType, now]
    );
    return {
      ...badge,
      earnedAt: now,
      synced: false,
    };
  },

  async insertFromRemote(
    db: SQLite.SQLiteDatabase,
    badge: { id: string; userId: string; badgeType: BadgeType; earnedAt: string }
  ): Promise<Badge> {
    await db.runAsync(
      'INSERT OR IGNORE INTO badges (id, user_id, badge_type, earned_at, synced) VALUES (?, ?, ?, ?, 1)',
      [badge.id, badge.userId, badge.badgeType, badge.earnedAt]
    );
    return { ...badge, synced: true };
  },

  async getByUserId(db: SQLite.SQLiteDatabase, userId: string): Promise<Badge[]> {
    const rows = await db.getAllAsync<BadgeRow>(
      'SELECT * FROM badges WHERE user_id = ? ORDER BY earned_at ASC',
      [userId]
    );
    return rows.map(rowToBadge);
  },

  async hasBadge(db: SQLite.SQLiteDatabase, userId: string, badgeType: BadgeType): Promise<boolean> {
    const row = await db.getFirstAsync<BadgeRow>(
      'SELECT * FROM badges WHERE user_id = ? AND badge_type = ?',
      [userId, badgeType]
    );
    return row !== null;
  },

  async getUnsynced(db: SQLite.SQLiteDatabase, userId: string): Promise<Badge[]> {
    const rows = await db.getAllAsync<BadgeRow>(
      'SELECT * FROM badges WHERE user_id = ? AND synced = 0',
      [userId]
    );
    return rows.map(rowToBadge);
  },

  async markSynced(db: SQLite.SQLiteDatabase, badgeId: string): Promise<void> {
    await db.runAsync('UPDATE badges SET synced = 1 WHERE id = ?', [badgeId]);
  },
};
