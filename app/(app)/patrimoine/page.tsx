import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PatrimoineClient } from "@/components/features/patrimoine/PatrimoineClient"

export default async function PatrimoinePage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  return <PatrimoineClient />
}
