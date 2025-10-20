import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { app } from 'electron';

export function createDb() {
  const dbPath = path.join(app.getPath('userData'), 'notes.db');
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });
  return db;
}


