import { getHouseholdId, unauthorized } from "@/lib/api"
import { buildFinanceContext } from "@/lib/server/finance-context"
import { INV_KINDS, computePortfolio } from "@/lib/finance/invest"

const cell = (v: string | number): string => {
  const s = String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const n = (v: number, d = 2) => v.toFixed(d).replace(".", ",")

// Portefeuille : lignes, prix de revient et plus-values latentes (valeurs converties en euro)
export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const ctx = buildFinanceContext(householdId)
  const S = computePortfolio(ctx, "equilibre")
  const head = ["Ligne", "Code", "Enveloppe", "Classe", "Zone", "Devise", "Quantité", "PRU", "Cours", "Valeur (€)", "Plus-value latente (€)", "Frais (%)"]
  const lines = S.pos.map((p) => {
    const a = ctx.invAccounts.find((x) => x.id === p.acct)
    return [p.name, p.tk, a ? `${INV_KINDS[a.kind].short} · ${a.name}` : "", p.cls, p.zone, p.cur, n(p.qty, 4), n(p.pru), n(p.price), n(p.value), n(p.pv), n(p.ter)].map(cell).join(";")
  })
  return new Response("﻿" + [head.join(";"), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="portefeuille-${new Date().toISOString().slice(0, 10)}.csv"` },
  })
}
