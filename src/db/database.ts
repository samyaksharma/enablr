import * as SQLite from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

let db: SQLite.SQLiteDatabase | null = null;
let opening: Promise<SQLite.SQLiteDatabase> | null = null;

// Callers that arrive while the database is still opening wait for the same
// open + migrate, so migrations can never run twice or be seen half-applied.
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return Promise.resolve(db);
  if (!opening) {
    opening = (async () => {
      const database = await SQLite.openDatabaseAsync('enablr.db');
      await runMigrations(database);
      db = database;
      return database;
    })().finally(() => {
      opening = null;
    });
  }
  return opening;
}

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  let currentVersion = 0;
  try {
    const result = await database.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_version'
    );
    currentVersion = result?.version ?? 0;
  } catch {
    // Table doesn't exist yet, version is 0
  }

  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      await database.withTransactionAsync(async () => {
        for (const statement of migration.statements) {
          await database.execAsync(statement);
        }
      });
    }
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
