import { db } from "@/lib/db"
import {
  transactions, accounts, categories, budgets, recurring, alerts,
  goals, goalPockets, properties, loans, investments, contracts, banks, members,
} from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { getHouseholdId, ok, unauthorized } from "@/lib/api"

export async function DELETE() {
  const householdId = await getHouseholdId()
  if (!householdId) return unauthorized()

  // goal_pockets FK → goals: delete pockets first via goal ids
  const goalRows = db.select({ id: goals.id }).from(goals).where(eq(goals.householdId, householdId)).all()
  if (goalRows.length > 0) {
    db.delete(goalPockets).where(inArray(goalPockets.goalId, goalRows.map(g => g.id))).run()
  }

  db.delete(goals).where(eq(goals.householdId, householdId)).run()
  db.delete(transactions).where(eq(transactions.householdId, householdId)).run()
  db.delete(budgets).where(eq(budgets.householdId, householdId)).run()
  db.delete(recurring).where(eq(recurring.householdId, householdId)).run()
  db.delete(alerts).where(eq(alerts.householdId, householdId)).run()
  db.delete(loans).where(eq(loans.householdId, householdId)).run()
  db.delete(properties).where(eq(properties.householdId, householdId)).run()
  db.delete(investments).where(eq(investments.householdId, householdId)).run()
  db.delete(contracts).where(eq(contracts.householdId, householdId)).run()
  db.delete(accounts).where(eq(accounts.householdId, householdId)).run()
  db.delete(categories).where(eq(categories.householdId, householdId)).run()
  db.delete(banks).where(eq(banks.householdId, householdId)).run()
  db.delete(members).where(eq(members.householdId, householdId)).run()

  return ok({ deleted: true })
}
