import { db } from "@/lib/db"
import { transactions, accounts, members, categories, banks, goals, projects } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { TransactionsClient } from "@/components/features/transactions/TransactionsClient"

export default async function TransactionsPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const txRows = db
    .select()
    .from(transactions)
    .where(eq(transactions.householdId, hid))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .all()

  const accountRows = db.select().from(accounts).where(eq(accounts.householdId, hid)).all()
  const memberRows = db.select().from(members).where(eq(members.householdId, hid)).all()
  const categoryRows = db.select().from(categories).where(eq(categories.householdId, hid)).all()
  const bankRows = db.select().from(banks).where(eq(banks.householdId, hid)).all()
  const goalRows = db.select().from(goals).where(eq(goals.householdId, hid)).all()
  const projectRows = db.select().from(projects).where(eq(projects.householdId, hid)).all()

  return (
    <TransactionsClient
      initialTransactions={txRows}
      accounts={accountRows}
      members={memberRows}
      categories={categoryRows}
      banks={bankRows}
      goals={goalRows}
      projects={projectRows}
    />
  )
}
