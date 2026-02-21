import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

const sqlite = new Database('workout.db')

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL')
// Enable foreign key enforcement (off by default in SQLite)
sqlite.pragma('foreign_keys = ON')

export const db = drizzle({ client: sqlite, schema })
