import { db } from "@/lib/db"
import { accounts } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized, err } from "@/lib/api"
import { revalidateTag } from "next/cache"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const { id } = await params
  const body = await req.json()
  if (typeof body.balanceCents !== "number") return err("balanceCents is required and must be a number")
  db.update(accounts)
    .set({ balanceCents: body.balanceCents })
    .where(and(eq(accounts.id, id), eq(accounts.householdId, householdId)))
    .run()
  revalidateTag("accounts")
  return ok(db.select().from(accounts).where(eq(accounts.id, id)).get())
}
