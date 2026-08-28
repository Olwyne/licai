import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PrevisionClient } from "@/components/features/previsions/PrevisionClient"

export default async function PrevisionsPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <PrevisionClient />
}
