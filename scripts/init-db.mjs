// Initialise la base au premier démarrage (production) : applique les migrations SQL si la base est vide.
// Les colonnes ajoutées depuis sont créées au démarrage de l'app par lib/db-ensure.ts. Ne modifie jamais une base existante.
import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

const dbPath = (process.env.DATABASE_URL ?? "file:./data/licai.db").replace("file:", "")
fs.mkdirSync(path.dirname(dbPath), { recursive: true })
const db = new Database(dbPath)
const has = db.prepare("select name from sqlite_master where type='table' and name='households'").get()
if (has) {
  console.log("[init-db] base existante : rien à faire")
} else {
  const dir = path.resolve("db/migrations")
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    db.exec(fs.readFileSync(path.join(dir, f), "utf8").replaceAll("--> statement-breakpoint", ""))
  }
  console.log(`[init-db] base créée : ${dbPath}`)
}
db.close()
