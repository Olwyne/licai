import { afterEach, beforeEach, describe, expect, it } from "vitest"
import Database from "better-sqlite3"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
// module .mjs partagé avec scripts/backup.mjs
import { backupDatabase, restoreDatabase, rotateBackups } from "@/lib/server/backup.mjs"

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "licai-bk-")) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function makeDb(file: string, rows = 3) {
  const db = new Database(file)
  db.pragma("journal_mode = WAL")
  db.exec("create table t (id integer primary key, v text)")
  for (let i = 0; i < rows; i++) db.prepare("insert into t (v) values (?)").run(`ligne ${i}`)
  return db
}

describe("sauvegarde SQLite", () => {
  it("copie une base en cours d'utilisation (WAL) de façon cohérente", async () => {
    const src = path.join(dir, "licai.db")
    const db = makeDb(src, 5)
    const { file } = await backupDatabase(src, path.join(dir, "backups"), 14, new Date("2026-10-19T08:30:00Z"))
    db.close()
    expect(path.basename(file)).toBe("licai-20261019-083000.db")
    const copy = new Database(file, { readonly: true })
    expect(copy.prepare("select count(*) c from t").get()).toEqual({ c: 5 })
    copy.close()
  })
  it("ne garde que les N sauvegardes les plus récentes", async () => {
    const src = path.join(dir, "licai.db"); makeDb(src).close()
    const bk = path.join(dir, "backups")
    for (const day of ["10", "11", "12", "13"]) await backupDatabase(src, bk, 3, new Date(`2026-10-${day}T01:00:00Z`))
    expect(fs.readdirSync(bk).sort()).toEqual(["licai-20261011-010000.db", "licai-20261012-010000.db", "licai-20261013-010000.db"])
    expect(rotateBackups(bk, 1)).toHaveLength(2)
  })
  it("restaure une sauvegarde en gardant l'ancienne base de côté", async () => {
    const src = path.join(dir, "licai.db"); makeDb(src, 2).close()
    const { file } = await backupDatabase(src, path.join(dir, "backups"))
    const db = new Database(src); db.prepare("insert into t (v) values ('de trop')").run(); db.close()
    restoreDatabase(file, src)
    const restored = new Database(src, { readonly: true })
    expect(restored.prepare("select count(*) c from t").get()).toEqual({ c: 2 })
    restored.close()
    expect(fs.existsSync(`${src}.avant-restauration`)).toBe(true)
  })
  it("refuse de restaurer un fichier corrompu", () => {
    const bad = path.join(dir, "bad.db"); fs.writeFileSync(bad, "ceci n'est pas une base SQLite")
    expect(() => restoreDatabase(bad, path.join(dir, "licai.db"))).toThrow()
  })
})
