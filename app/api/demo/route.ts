import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { households, users } from "@/db/schema"
import { seedDemoData } from "@/db/seed"
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo"

// Crée (une seule fois) le foyer de démonstration partagé ; le client s'y connecte ensuite avec signIn.
export async function POST() {
  if (!db.select().from(users).where(eq(users.email, DEMO_EMAIL)).get()) {
    const householdId = randomUUID()
    const now = new Date()
    db.insert(households).values({ id: householdId, name: "Foyer Lambert · Roux (démo)", city: "Lyon", createdAt: now }).run()
    db.insert(users).values({
      id: randomUUID(), householdId, email: DEMO_EMAIL, passwordHash: await bcrypt.hash(DEMO_PASSWORD, 12),
      role: "admin", firstName: "Sophie", lastName: "Lambert", createdAt: now,
    }).run()
    seedDemoData(householdId)
  }
  return NextResponse.json({ data: { email: DEMO_EMAIL, password: DEMO_PASSWORD } })
}
