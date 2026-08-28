import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { RapportView } from "@/components/features/rapport/RapportView"

export default async function RapportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await auth()
  if (!session?.user?.householdId) redirect("/login")
  const { month: monthParam } = await searchParams
  const month = monthParam ?? new Date().toISOString().slice(0, 7)
  return <RapportView month={month} householdId={session.user.householdId} />
}
