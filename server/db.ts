import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure the data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database
export const sqlite = new Database(join(dataDir, 'music_videos.db'));

// Create tables directly using SQLite
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0
  );
  
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  );
  
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    youtube_id TEXT NOT NULL,
    category_id INTEGER,
    created_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );
`);

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });
