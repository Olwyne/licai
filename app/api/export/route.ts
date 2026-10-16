import { db } from "@/lib/db"
import { getHouseholdId, unauthorized } from "@/lib/api"
import {
  accounts, categories, transactions, budgets,
  recurring, alerts, goals, members, banks,
} from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  const [
    accountsData, categoriesData, transactionsData, budgetsData,
    recurringData, alertsData, goalsData, membersData, banksData,
  ] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.householdId, householdId)),
    db.select().from(categories).where(eq(categories.householdId, householdId)),
    db.select().from(transactions).where(eq(transactions.householdId, householdId)),
    db.select().from(budgets).where(eq(budgets.householdId, householdId)),
    db.select().from(recurring).where(eq(recurring.householdId, householdId)),
    db.select().from(alerts).where(eq(alerts.householdId, householdId)),
    db.select().from(goals).where(eq(goals.householdId, householdId)),
    db.select().from(members).where(eq(members.householdId, householdId)),
    db.select().from(banks).where(eq(banks.householdId, householdId)),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    accounts: accountsData,
    categories: categoriesData,
    transactions: transactionsData,
    budgets: budgetsData,
    recurring: recurringData,
    alerts: alertsData,
    goals: goalsData,
    members: membersData,
    banks: banksData,
  }

  const filename = `licai-export-${new Date().toISOString().slice(0, 10)}.json`

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
