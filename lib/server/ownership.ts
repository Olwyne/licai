import { db } from "@/lib/db"

// Les identifiants reçus du client (compte, catégorie, personne, objectif, projet) doivent appartenir au foyer connecté :
// sans ce contrôle, une opération pourrait référencer les données d'un autre foyer.
const TABLES = { accountId: "accounts", toAccountId: "accounts", categoryId: "categories", memberId: "members", goalId: "goals", projectId: "projects" } as const
export type RefKey = keyof typeof TABLES

const label: Record<RefKey, string> = { accountId: "compte", toAccountId: "compte de destination", categoryId: "catégorie", memberId: "personne", goalId: "objectif", projectId: "projet" }

/** `true` si l'identifiant existe dans la table et appartient au foyer. */
export function owns(householdId: string, key: RefKey, id: string): boolean {
  return !!db.$client.prepare(`SELECT 1 FROM ${TABLES[key]} WHERE id = ? AND household_id = ?`).get(id, householdId)
}

/** Message d'erreur si une référence renseignée n'appartient pas au foyer, sinon `null`. Les valeurs vides sont ignorées. */
export function foreignRef(householdId: string, refs: Partial<Record<RefKey, unknown>>): string | null {
  for (const [key, id] of Object.entries(refs) as [RefKey, unknown][]) {
    if (id === null || id === undefined || id === "") continue
    if (typeof id !== "string" || !owns(householdId, key, id)) return `Référence invalide : ${label[key]} introuvable.`
  }
  return null
}
