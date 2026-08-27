import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function getHouseholdId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.householdId ?? null
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
