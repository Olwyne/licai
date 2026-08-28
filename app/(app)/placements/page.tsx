import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PlacementsClient } from "@/components/features/placements/PlacementsClient"

export default async function PlacementsPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <PlacementsClient />
}
