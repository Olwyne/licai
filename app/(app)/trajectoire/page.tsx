import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { TrajectoireClient } from "@/components/features/trajectoire/TrajectoireClient"

export default async function TrajectoirePage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <TrajectoireClient />
}
