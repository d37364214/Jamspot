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

// Abandon des tables existantes et création des nouvelles tables selon le schéma
sqlite.exec(`
  -- Drop existing tables if they exist
  DROP TABLE IF EXISTS video_tags;
  DROP TABLE IF EXISTS activity_logs;
  DROP TABLE IF EXISTS videos;
  DROP TABLE IF EXISTS subcategories;
  DROP TABLE IF EXISTS tags;
  DROP TABLE IF EXISTS categories;
  DROP TABLE IF EXISTS users;
  
  -- Create updated tables
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    last_login TEXT
  );
  
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL UNIQUE,
    parent_id INTEGER,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (parent_id) REFERENCES categories (id)
  );
  
  CREATE TABLE IF NOT EXISTS subcategories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT NOT NULL UNIQUE,
    category_id INTEGER NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id)
  );
  
  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    created_at TEXT
  );
  
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    youtube_id TEXT NOT NULL,
    category_id INTEGER,
    subcategory_id INTEGER,
    thumbnail TEXT,
    duration TEXT,
    created_at TEXT,
    updated_at TEXT,
    views INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories (id),
    FOREIGN KEY (subcategory_id) REFERENCES subcategories (id)
  );
  
  CREATE TABLE IF NOT EXISTS video_tags (
    video_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (video_id, tag_id),
    FOREIGN KEY (video_id) REFERENCES videos (id),
    FOREIGN KEY (tag_id) REFERENCES tags (id)
  );
  
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    timestamp TEXT,
    ip_address TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  );
`);

// Créer un compte administrateur par défaut si nécessaire
export function createAdminUserIfNotExists() {
  try {
    const adminUsername = 'Admin';
    console.log(`Vérification de l'existence du compte administrateur: ${adminUsername}`);
    
    // Vérifier si l'utilisateur admin existe déjà
    const adminUser = sqlite.prepare('SELECT * FROM users WHERE username = ?').get(adminUsername);
    
    if (!adminUser) {
      console.log('Création du compte administrateur par défaut...');
      // Le mot de passe par défaut est "admin", normalement il faudrait le hasher
      // Pour une démonstration simple, on utilise un mot de passe en clair (à ne pas faire en production)
      sqlite.prepare(
        'INSERT INTO users (username, password, is_admin, created_at) VALUES (?, ?, ?, ?)'
      ).run(adminUsername, 'admin', 1, new Date().toISOString());
      console.log('Compte administrateur créé avec succès');
    } else {
      console.log('Le compte administrateur existe déjà');
    }
  } catch (error) {
    console.error('Erreur lors de la création du compte admin:', error);
  }
}

// Exécuter la création de l'utilisateur admin
createAdminUserIfNotExists();

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });
