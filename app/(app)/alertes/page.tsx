import { db } from "@/lib/db"
import { alerts } from "@/db/schema"
import { eq, desc } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AlertesClient } from "@/components/features/alerts/AlertesClient"

export default async function AlertesPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const hid = session.user.householdId

  const alertRows = db
    .select()
    .from(alerts)
    .where(eq(alerts.householdId, hid))
    .orderBy(desc(alerts.date))
    .all()

  return <AlertesClient initialAlerts={alertRows} />
}
