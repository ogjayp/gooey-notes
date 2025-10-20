import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export async function runMigrations() {
  const dbPath = path.join(app.getPath('userData'), 'notes.db');
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle', 'migrations') });
}


