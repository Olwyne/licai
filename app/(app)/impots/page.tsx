import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ImpotsClient } from "@/components/features/impots/ImpotsClient"

export default async function ImpotsPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <ImpotsClient />
}
