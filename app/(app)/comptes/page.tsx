import { db } from "@/lib/db"
import { accounts, members, banks, households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AccountsClient } from "@/components/features/accounts/AccountsClient"
import type { EnrichedAccount } from "@/components/features/accounts/types"

export default async function ComptesPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const household = db
    .select()
    .from(households)
    .where(eq(households.id, hid))
    .get()

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

  const accountRows = db
    .select()
    .from(accounts)
    .where(eq(accounts.householdId, hid))
    .all()

  const memberMap = new Map(memberRows.map((m) => [m.id, m]))

  const enrichedAccounts: EnrichedAccount[] = accountRows.map((a) => {
    const ownerIds: string[] = JSON.parse(a.ownerIds)
    const ownerNames = ownerIds.map((id) => memberMap.get(id)?.name ?? id)
    return { ...a, ownerIds, ownerNames }
  })

  const householdName = household?.name ?? session.user.name ?? "Foyer"

  return (
    <AccountsClient
      household={{ name: householdName, householdId: hid }}
      members={memberRows}
      banks={bankRows}
      accounts={enrichedAccounts}
    />
  )
}
