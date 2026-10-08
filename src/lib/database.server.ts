import Database from "better-sqlite3";
import { Pool } from "pg";

const databaseUrl = process.env["DATABASE_URL"];
export const databaseKind = databaseUrl?.startsWith("postgres") ? "postgres" : "sqlite";
export const databaseClient =
  databaseKind === "postgres"
    ? new Pool({ connectionString: databaseUrl })
    : new Database(process.env["LOCAL_DATABASE_PATH"] ?? "./data/fluxo.sqlite");

if (databaseKind === "sqlite") (databaseClient as Database.Database).pragma("foreign_keys = ON");

function postgresSql(sql: string) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function execute(sql: string, params: unknown[] = []) {
  if (databaseKind === "postgres") return (databaseClient as Pool).query(postgresSql(sql), params);
  return (databaseClient as Database.Database).prepare(sql).run(...params);
}

export async function rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (databaseKind === "postgres")
    return (await (databaseClient as Pool).query(postgresSql(sql), params)).rows as T[];
  return (databaseClient as Database.Database).prepare(sql).all(...params) as T[];
}

export async function row<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(sql, params))[0];
}

let initialized: Promise<void> | undefined;
export function initializeAppDatabase() {
  if (initialized) return initialized;
  initialized = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL, status TEXT NOT NULL, due_date TEXT NOT NULL, created_by TEXT NOT NULL, assigned_to TEXT NOT NULL, status_changed_at TEXT, created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS task_comments (id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS task_events (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, actor_id TEXT, event_type TEXT NOT NULL, old_status TEXT, new_status TEXT, details TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS task_deletions (id TEXT PRIMARY KEY, task_id TEXT NOT NULL, title TEXT NOT NULL, deleted_by TEXT NOT NULL, reason TEXT NOT NULL, deleted_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS password_reset_links (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, requested_by TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS notification_outbox (id TEXT PRIMARY KEY, event_type TEXT NOT NULL, recipient_email TEXT NOT NULL, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, processed_at TEXT, last_error TEXT, created_at TEXT NOT NULL)`,
    ];
    for (const statement of statements) await execute(statement);
  })();
  return initialized;
}
