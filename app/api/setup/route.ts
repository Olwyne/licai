import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { households, users } from "@/db/schema"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { seedDemoData } from "@/db/seed"

export async function GET() {
  const h = db.select().from(households).get()
  return NextResponse.json({ data: { exists: !!h } })
}

export async function POST(req: Request) {
  const existing = db.select().from(households).get()
  if (existing) return NextResponse.json({ error: "Already set up" }, { status: 409 })

  const { householdName, city, email, password, seed } = await req.json()
  if (!householdName || !email || !password || password.length < 8) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }

  const householdId = randomUUID()
  const userId = randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()

  db.insert(households).values({ id: householdId, name: householdName, city, createdAt: now }).run()
  db.insert(users).values({ id: userId, householdId, email, passwordHash, role: "admin", createdAt: now }).run()

  if (seed) seedDemoData(householdId)

  return NextResponse.json({ data: { ok: true } })
}
