import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PartageClient } from "@/components/features/partage/PartageClient"

export default async function PartagePage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <PartageClient />
}
