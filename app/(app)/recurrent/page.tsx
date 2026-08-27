import { db } from "@/lib/db"
import { recurring, accounts, categories, members, banks } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RecurringClient } from "@/components/features/recurring/RecurringClient"

export default async function RecurrentPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const recurringRows = db
    .select()
    .from(recurring)
    .where(eq(recurring.householdId, hid))
    .all()

  const accountRows = db
    .select()
    .from(accounts)
    .where(eq(accounts.householdId, hid))
    .all()

  const categoryRows = db
    .select()
    .from(categories)
    .where(eq(categories.householdId, hid))
    .all()

  const memberRows = db
    .select()
    .from(members)
    .where(eq(members.householdId, hid))
    .all()

  const bankRows = db
    .select()
    .from(banks)
    .where(eq(banks.householdId, hid))
    .all()

  return (
    <RecurringClient
      initialRecurring={recurringRows}
      accounts={accountRows}
      categories={categoryRows}
      members={memberRows}
      banks={bankRows}
    />
  )
}
