import { db } from "@/lib/db"
import { members } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { revalidateTag } from "next/cache"

const ALLOWED = ["name", "short", "role", "colorHex", "monthlyIncomeCents", "birthYear", "retireYear", "allowanceCents"] as const

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const body = await req.json()
  const patch: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in body) patch[k] = body[k]
  if (!Object.keys(patch).length) return err("Rien à modifier")
  db.update(members).set(patch).where(and(eq(members.id, id), eq(members.householdId, householdId))).run()
  revalidateTag("members", { expire: 0 })
  const row = db.select().from(members).where(and(eq(members.id, id), eq(members.householdId, householdId))).get()
  return row ? ok(row) : err("Membre introuvable", 404)
}
