import { db } from "@/lib/db"
import { transactions, accounts, categories, members } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { getHouseholdId, unauthorized } from "@/lib/api"

const cell = (v: string | number): string => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV compatible Excel / Google Sheets : séparateur « ; », décimale « , », BOM UTF-8
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const acc = new Map(db.select().from(accounts).where(eq(accounts.householdId, householdId)).all().map((a) => [a.id, a.name]))
  const cat = new Map(db.select().from(categories).where(eq(categories.householdId, householdId)).all().map((c) => [c.id, c.label]))
  const mem = new Map(db.select().from(members).where(eq(members.householdId, householdId)).all().map((m) => [m.id, m.name]))
  const rows = db.select().from(transactions).where(eq(transactions.householdId, householdId)).orderBy(desc(transactions.date)).all()
  const head = ["Date", "Libellé", "Montant", "Type", "Catégorie", "Compte", "Attribué à", "Commune", "Note"]
  const lines = rows.map((t) => [
    t.date, t.name, (t.amountCents / 100).toFixed(2).replace(".", ","), t.kind,
    t.categoryId ? cat.get(t.categoryId) ?? "" : "", t.accountId ? acc.get(t.accountId) ?? "" : "",
    t.memberId ? mem.get(t.memberId) ?? "" : "", t.isCommon ? "oui" : "non", t.note,
  ].map(cell).join(";"))
  const body = "﻿" + [head.join(";"), ...lines].join("\r\n")
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"` },
  })
}
