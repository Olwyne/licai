import { db } from "@/lib/db"

type Row = { name: string }

/**
 * Supprime les données d'un foyer (toutes les tables portant household_id + les tables enfants).
 * keepAccount = true conserve le foyer et ses utilisateurs (remise à zéro) ; sinon le foyer est supprimé.
 */
export function purgeHousehold(householdId: string, { keepAccount = false } = {}): void {
  const sqlite = db.$client
  const tables = (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\'").all() as Row[]).map((t) => t.name)
  const withHousehold = tables.filter((t) =>
    (sqlite.prepare(`PRAGMA table_info(${t})`).all() as Row[]).some((c) => c.name === "household_id"))

  const run = sqlite.transaction(() => {
    // tables enfants sans household_id
    const del = (sql: string) => { try { sqlite.prepare(sql).run(householdId) } catch { /* table absente */ } }
    del("DELETE FROM goal_pockets WHERE goal_id IN (SELECT id FROM goals WHERE household_id = ?)")
    del("DELETE FROM property_owners WHERE property_id IN (SELECT id FROM properties WHERE household_id = ?)")
    if (!keepAccount) del("DELETE FROM password_resets WHERE user_id IN (SELECT id FROM users WHERE household_id = ?)")
    for (const t of withHousehold) {
      if (keepAccount && t === "users") continue
      sqlite.prepare(`DELETE FROM ${t} WHERE household_id = ?`).run(householdId)
    }
    if (!keepAccount) sqlite.prepare("DELETE FROM households WHERE id = ?").run(householdId)
  })
  sqlite.pragma("foreign_keys = OFF")
  try { run() } finally { sqlite.pragma("foreign_keys = ON") }
}
