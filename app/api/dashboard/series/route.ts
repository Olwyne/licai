import { getHouseholdId, ok, err, unauthorized } from "@/lib/api"
import { buildSeries, type PeriodKey } from "@/lib/server/dashboard-series"

const KEYS = ["j", "s", "w", "m", "t", "a", "c"]
const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()
  const q = new URL(req.url).searchParams
  const period = q.get("period") ?? "m"
  const anchor = q.get("anchor") ?? new Date().toISOString().slice(0, 10)
  if (!KEYS.includes(period) || !DATE.test(anchor)) return err("Paramètres invalides.", 400)
  const from = q.get("from"), to = q.get("to")
  if (period === "c" && (!from || !to || !DATE.test(from) || !DATE.test(to) || from > to)) return err("Période invalide.", 400)
  try {
    return ok(buildSeries(householdId, period as PeriodKey, anchor, period === "c" ? { from: from!, to: to! } : undefined))
  } catch {
    return err("Erreur de base de données.", 500)
  }
}
