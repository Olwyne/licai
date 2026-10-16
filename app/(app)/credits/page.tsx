import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CreditsClient } from "@/components/features/credits/CreditsClient"

export default async function CreditsPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <CreditsClient />
}
