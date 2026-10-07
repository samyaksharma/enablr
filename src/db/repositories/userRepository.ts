import * as SQLite from 'expo-sqlite';
import { User, CharacterClass } from '../../types';

interface UserRow {
  id: string;
  name: string;
  character_name: string;
  character_class: string;
  xp: number;
  level: number;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    characterName: row.character_name,
    characterClass: row.character_class as CharacterClass,
    xp: row.xp,
    level: row.level,
    createdAt: row.created_at,
  };
}

export const userRepository = {
  async create(
    db: SQLite.SQLiteDatabase,
    user: {
      id: string;
      name: string;
      characterName: string;
      characterClass: CharacterClass;
      xp?: number;
      level?: number;
    }
  ): Promise<User> {
    const now = new Date().toISOString();
    const xp = user.xp ?? 0;
    const level = user.level ?? 1;
    await db.runAsync(
      'INSERT INTO users (id, name, character_name, character_class, xp, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [user.id, user.name, user.characterName, user.characterClass, xp, level, now]
    );
    return {
      ...user,
      xp,
      level,
      createdAt: now,
    };
  },

  async getById(db: SQLite.SQLiteDatabase, id: string): Promise<User | null> {
    const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return row ? rowToUser(row) : null;
  },

  async updateXpAndLevel(
    db: SQLite.SQLiteDatabase,
    userId: string,
    xp: number,
    level: number
  ): Promise<void> {
    await db.runAsync('UPDATE users SET xp = ?, level = ? WHERE id = ?', [xp, level, userId]);
  },

  async updateCharacter(
    db: SQLite.SQLiteDatabase,
    userId: string,
    characterName: string,
    characterClass: CharacterClass
  ): Promise<void> {
    await db.runAsync(
      'UPDATE users SET character_name = ?, character_class = ? WHERE id = ?',
      [characterName, characterClass, userId]
    );
  },
};
