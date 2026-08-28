import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ObjectifsClient from "@/components/features/objectifs/ObjectifsClient"

export default async function ObjectifsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  return <ObjectifsClient />
}
