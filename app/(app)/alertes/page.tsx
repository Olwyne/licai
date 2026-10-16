import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AlertesClient } from "@/components/features/alerts/AlertesClient"
import { buildAlertsData } from "@/lib/server/alerts-data"

export default async function AlertesPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <AlertesClient data={buildAlertsData(session.user.householdId)} />
}
