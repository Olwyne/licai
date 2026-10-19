// Sauvegarde de la base SQLite.
//   node scripts/backup.mjs            → une sauvegarde puis sortie
//   node scripts/backup.mjs --loop     → une sauvegarde toutes les BACKUP_INTERVAL_HOURS (24 h par défaut)
//   node scripts/backup.mjs --restore <fichier>
// Variables : DATABASE_URL (file:/app/data/licai.db), BACKUP_DIR (/app/data/backups), BACKUP_KEEP (14)
import { backupDatabase, restoreDatabase } from "../lib/server/backup.mjs"

const dbPath = (process.env.DATABASE_URL ?? "file:./data/licai.db").replace("file:", "")
const dir = process.env.BACKUP_DIR ?? `${dbPath.replace(/[^/]+$/, "")}backups`
const keep = Number(process.env.BACKUP_KEEP ?? 14)
const args = process.argv.slice(2)

if (args[0] === "--restore") {
  if (!args[1]) { console.error("usage : node scripts/backup.mjs --restore <fichier.db>"); process.exit(1) }
  restoreDatabase(args[1], dbPath)
  console.log(`[backup] base restaurée depuis ${args[1]} (ancienne base : ${dbPath}.avant-restauration)`)
  process.exit(0)
}

async function once() {
  try {
    const { file, removed } = await backupDatabase(dbPath, dir, keep)
    console.log(`[backup] ${file}${removed.length ? ` (${removed.length} ancienne(s) supprimée(s))` : ""}`)
  } catch (e) {
    console.error(`[backup] échec : ${e.message}`)
    if (!args.includes("--loop")) process.exit(1)
  }
}

await once()
if (args.includes("--loop")) {
  const every = Number(process.env.BACKUP_INTERVAL_HOURS ?? 24) * 3600_000
  setInterval(once, every)
}
