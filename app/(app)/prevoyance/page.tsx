import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PrevoyanceClient } from "@/components/features/prevoyance/PrevoyanceClient"

export default async function PrevoyancePage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <PrevoyanceClient />
}
