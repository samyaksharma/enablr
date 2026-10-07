export const MIGRATIONS = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        character_name TEXT NOT NULL DEFAULT '',
        character_class TEXT NOT NULL DEFAULT 'warrior',
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );`,
      `CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        recurrence TEXT NOT NULL DEFAULT '{"type":"daily"}',
        category TEXT NOT NULL DEFAULT 'custom',
        difficulty TEXT NOT NULL DEFAULT 'easy',
        scheduled_time TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        client_id TEXT NOT NULL DEFAULT '',
        local_version INTEGER NOT NULL DEFAULT 1,
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS completions (
        id TEXT PRIMARY KEY NOT NULL,
        habit_id TEXT NOT NULL,
        completed_at TEXT NOT NULL DEFAULT (datetime('now')),
        xp_earned INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0,
        local_version INTEGER NOT NULL DEFAULT 1,
        client_id TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (habit_id) REFERENCES habits(id)
      );`,
      `CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        badge_type TEXT NOT NULL,
        earned_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );`,
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY NOT NULL
      );`,
      `INSERT INTO schema_version (version) VALUES (1);`,
    ],
  },
  {
    // Rows written before accounts had real IDs were all filed under one
    // placeholder user. They were test data only, so start clean.
    version: 2,
    statements: [
      `DELETE FROM completions;`,
      `DELETE FROM badges;`,
      `DELETE FROM habits;`,
      `DELETE FROM users;`,
      `INSERT INTO schema_version (version) VALUES (2);`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE habits ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;`,
      // Last known result of each guild query, so guild screens open instantly
      // and stay readable offline. The server remains the source of truth.
      `CREATE TABLE IF NOT EXISTS query_cache (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      );`,
      `INSERT INTO schema_version (version) VALUES (3);`,
    ],
  },
];
