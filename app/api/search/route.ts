import { db } from "@/lib/db"
import { transactions, accounts, members, categories } from "@/db/schema"
import { eq, and, like, or } from "drizzle-orm"
import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"

export interface SearchResult {
  kind: "transaction" | "account" | "member" | "category"
  id: string
  label: string
  sub: string
  href: string
}

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const url = new URL(req.url)
  const q = url.searchParams.get("q") ?? ""

  if (q.trim().length < 2) {
    return ok({ results: [] as SearchResult[], total: 0 })
  }

  const pattern = `%${q}%`

  try {
    const txRows = db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.householdId, householdId),
        or(
          like(transactions.name, pattern),
          like(transactions.note, pattern)
        )
      ))
      .limit(5)
      .all()

    const accountRows = db
      .select()
      .from(accounts)
      .where(and(
        eq(accounts.householdId, householdId),
        like(accounts.name, pattern)
      ))
      .limit(3)
      .all()

    const memberRows = db
      .select()
      .from(members)
      .where(and(
        eq(members.householdId, householdId),
        like(members.name, pattern)
      ))
      .limit(3)
      .all()

    const categoryRows = db
      .select()
      .from(categories)
      .where(and(
        eq(categories.householdId, householdId),
        like(categories.label, pattern)
      ))
      .limit(3)
      .all()

    const results: SearchResult[] = [
      ...txRows.map((t) => ({
        kind: "transaction" as const,
        id: t.id,
        label: t.name,
        sub: t.note || t.date,
        href: "/transactions",
      })),
      ...accountRows.map((a) => ({
        kind: "account" as const,
        id: a.id,
        label: a.name,
        sub: a.type,
        href: "/comptes",
      })),
      ...memberRows.map((m) => ({
        kind: "member" as const,
        id: m.id,
        label: m.name,
        sub: m.role,
        href: "/comptes",
      })),
      ...categoryRows.map((c) => ({
        kind: "category" as const,
        id: c.id,
        label: c.label,
        sub: "",
        href: "/transactions",
      })),
    ]

    return ok({ results, total: results.length })
  } catch {
    return err("Erreur serveur", 500)
  }
}
