import { db } from "@/lib/db"
import { csvTemplates } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { sanitizeTemplate, type CsvTemplate } from "@/lib/finance/csv-import"
import { randomUUID } from "crypto"

export type SavedCsvTemplate = CsvTemplate & { id: string }

function toTemplate(row: { id: string; name: string; bankId: string | null; config: string }): SavedCsvTemplate | null {
  try {
    const t = sanitizeTemplate({ ...(JSON.parse(row.config) as object), name: row.name, bankId: row.bankId })
    return t ? { ...t, id: row.id } : null
  } catch { return null }
}

// GET : modèles de colonnes enregistrés par le foyer (un par format d'export bancaire).
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const rows = db.select().from(csvTemplates).where(eq(csvTemplates.householdId, householdId)).all()
  return ok(rows.map(toTemplate).filter((t): t is SavedCsvTemplate => t !== null).sort((a, b) => a.name.localeCompare(b.name, "fr")))
}

// PUT { template } : crée le modèle, ou met à jour celui qui porte le même nom.
export async function PUT(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const body = (await req.json().catch(() => null)) as { template?: unknown } | null
  const t = sanitizeTemplate(body?.template)
  if (!t) return err("Modèle invalide : nom et colonnes (date, libellé, montant) requis.", 400)
  const { name, bankId, ...config } = t
  const existing = db.select().from(csvTemplates).where(and(eq(csvTemplates.householdId, householdId), eq(csvTemplates.name, name))).get()
  if (existing) {
    db.update(csvTemplates).set({ bankId, config: JSON.stringify(config) }).where(eq(csvTemplates.id, existing.id)).run()
    return ok({ ...t, id: existing.id })
  }
  const id = randomUUID()
  db.insert(csvTemplates).values({ id, householdId, name, bankId, config: JSON.stringify(config), createdAt: new Date() }).run()
  return ok({ ...t, id }, 201)
}
