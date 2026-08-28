import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ParametresClient } from "@/components/features/parametres/ParametresClient"

export const metadata = { title: "Paramètres — Lǐcái" }

export default async function ParametresPage() {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")

  return <ParametresClient />
}
