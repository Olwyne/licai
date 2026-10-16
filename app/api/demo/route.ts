import { NextResponse } from "next/server"
import { like } from "drizzle-orm"
import { randomBytes, randomUUID } from "crypto"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { households, users } from "@/db/schema"
import { seedDemoData } from "@/db/seed"
import { DEMO_DOMAIN, DEMO_MAX_HOUSEHOLDS, DEMO_TTL_HOURS } from "@/lib/demo"
import { purgeHousehold } from "@/lib/server/household-purge"

const hits = new Map<string, number[]>() // limite par IP : 10 démos / heure

// Crée un foyer de démonstration isolé (données de Lambert · Roux) et renvoie ses identifiants ; le client s'y connecte via signIn.
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local"
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000)
  if (recent.length >= 10) return NextResponse.json({ error: "Trop de démonstrations demandées, réessayez plus tard." }, { status: 429 })
  hits.set(ip, [...recent, now])

  // purge des démos expirées
  const demos = db.select().from(users).where(like(users.email, `%@${DEMO_DOMAIN}`)).all()
  const cutoff = now - DEMO_TTL_HOURS * 3600_000
  for (const u of demos) if (u.createdAt.getTime() < cutoff) purgeHousehold(u.householdId)
  if (demos.length - demos.filter((u) => u.createdAt.getTime() < cutoff).length >= DEMO_MAX_HOUSEHOLDS) {
    return NextResponse.json({ error: "Démonstration momentanément indisponible." }, { status: 503 })
  }

  const email = `demo-${randomBytes(5).toString("hex")}@${DEMO_DOMAIN}`
  const password = `Demo-${randomBytes(9).toString("base64url")}1`
  const householdId = randomUUID()
  const created = new Date()
  db.insert(households).values({ id: householdId, name: "Foyer Lambert · Roux (démo)", city: "Lyon", createdAt: created }).run()
  db.insert(users).values({
    id: randomUUID(), householdId, email, passwordHash: await bcrypt.hash(password, 10),
    role: "admin", firstName: "Sophie", lastName: "Lambert", createdAt: created,
  }).run()
  seedDemoData(householdId)
  return NextResponse.json({ data: { email, password } })
}
