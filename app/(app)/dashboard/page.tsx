import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardClient } from "@/components/features/dashboard/DashboardClient"
import { buildDashboardData } from "@/lib/server/dashboard-data"

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const data = buildDashboardData(session.user.householdId, session.user.name)
  return <DashboardClient initialData={data} />
}
