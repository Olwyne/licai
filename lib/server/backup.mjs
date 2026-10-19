// Sauvegarde cohérente d'une base SQLite (API de sauvegarde en ligne : sûre même si l'app écrit pendant la copie)
// et rotation des anciennes sauvegardes. Utilisé par scripts/backup.mjs et testé en unitaire.
import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15)

/** Copie `dbPath` dans `dir` sous « licai-AAAAMMJJ-HHMMSS.db », puis ne garde que les `keep` plus récentes. */
export async function backupDatabase(dbPath, dir, keep = 14, now = new Date()) {
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, `licai-${stamp(now)}.db`)
  const src = new Database(dbPath, { readonly: true, fileMustExist: true })
  try { await src.backup(target) } finally { src.close() }
  // la copie reprend le mode WAL de la source : on la ramène à un fichier unique, puis on la vérifie
  const copy = new Database(target)
  copy.pragma("journal_mode = DELETE")
  const ok = copy.pragma("integrity_check", { simple: true }) === "ok"
  copy.close()
  if (!ok) { fs.rmSync(target, { force: true }); throw new Error("sauvegarde corrompue (integrity_check)") }
  return { file: target, removed: rotateBackups(dir, keep) }
}

export function rotateBackups(dir, keep) {
  const files = fs.readdirSync(dir).filter((f) => /^licai-\d{8}-\d{6}\.db$/.test(f)).sort()
  const old = files.slice(0, Math.max(0, files.length - keep))
  for (const f of old) for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(path.join(dir, f + suffix), { force: true })
  return old
}

/** Remplace la base par une sauvegarde (l'ancienne est conservée en « .avant-restauration »). */
export function restoreDatabase(backupFile, dbPath) {
  const check = new Database(backupFile, { readonly: true, fileMustExist: true })
  const ok = check.pragma("integrity_check", { simple: true }) === "ok"
  check.close()
  if (!ok) throw new Error("la sauvegarde est corrompue : restauration annulée")
  if (fs.existsSync(dbPath)) fs.copyFileSync(dbPath, `${dbPath}.avant-restauration`)
  for (const s of ["-wal", "-shm"]) fs.rmSync(dbPath + s, { force: true })
  fs.copyFileSync(backupFile, dbPath)
}
