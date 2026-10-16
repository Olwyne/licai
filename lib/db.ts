import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "@/db/schema"
import path from "path"
import fs from "fs"
import { ensureSchema } from "@/lib/db-ensure"

const dbPath = process.env.DATABASE_URL?.replace("file:", "") ?? "./data/licai.db"
const dir = path.dirname(dbPath)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma("journal_mode = WAL")
sqlite.pragma("foreign_keys = ON")
ensureSchema(sqlite)

export const db = drizzle(sqlite, { schema })
