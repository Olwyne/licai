// Prépare la base SQLite des tests e2e : repart de zéro et applique les migrations SQL.
// (les colonnes ajoutées depuis sont créées au démarrage de l'app par lib/db-ensure.ts)
import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

const dbPath = (process.env.DATABASE_URL ?? "file:./data/test.db").replace("file:", "")
fs.mkdirSync(path.dirname(dbPath), { recursive: true })
for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true })

const db = new Database(dbPath)
const dir = path.resolve("db/migrations")
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  db.exec(fs.readFileSync(path.join(dir, f), "utf8").replaceAll("--> statement-breakpoint", ""))
}
db.close()
console.log(`[e2e] base préparée : ${dbPath}`)
