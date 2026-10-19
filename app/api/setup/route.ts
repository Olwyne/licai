import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { households, members, users } from "@/db/schema"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"
import { seedDemoData } from "@/db/seed"
import { FIAT_CODES } from "@/lib/finance/fx"
import { passwordIssue } from "@/lib/password"

/** Inscriptions fermées par ALLOW_SIGNUP=false (instance personnelle : on crée son foyer, puis on ferme). */
const signupOpen = () => process.env.ALLOW_SIGNUP !== "false"


export async function GET() {
  const h = db.select().from(households).get()
  return NextResponse.json({ data: { exists: !!h, signupOpen: signupOpen() } })
}

// Inscription ouverte : chaque inscription crée un nouveau foyer (données isolées par householdId).
export async function POST(req: Request) {
  if (!signupOpen()) return NextResponse.json({ error: "Les inscriptions sont fermées sur cette instance." }, { status: 403 })
  const body = await req.json()
  const householdName = String(body.householdName ?? "").trim()
  const firstName = String(body.firstName ?? "").trim()
  const lastName = String(body.lastName ?? "").trim()
  const email = String(body.email ?? "").trim().toLowerCase()
  const password = String(body.password ?? "")
  const city = body.city ? String(body.city).trim() : null
  const currency = FIAT_CODES.includes(body.currency) ? body.currency : "EUR"

  if (!householdName || !email.includes("@")) {
    return NextResponse.json({ error: "Renseignez le nom du foyer et une adresse e-mail valide." }, { status: 400 })
  }
  const issue = passwordIssue(password)
  if (issue) return NextResponse.json({ error: issue }, { status: 400 })
  if (db.select().from(users).where(eq(users.email, email)).get()) {
    return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 })
  }

  const householdId = randomUUID()
  const userId = randomUUID()
  const passwordHash = await bcrypt.hash(password, 12)
  const now = new Date()

  // tout ou rien : un échec (adresse prise entre-temps, par exemple) ne laisse pas de foyer orphelin
  try {
    db.transaction(() => {
      db.insert(households).values({ id: householdId, name: householdName, city, currency, createdAt: now }).run()
      db.insert(users).values({ id: userId, householdId, email, passwordHash, role: "admin", firstName: firstName || null, lastName: lastName || null, createdAt: now }).run()
      if (body.seed) {
        seedDemoData(householdId)
      } else {
        if (firstName) {
          db.insert(members).values({
            id: randomUUID(), householdId, name: `${firstName} ${lastName}`.trim(), short: firstName,
            role: "Administrateur", colorHex: "#1D9E75", monthlyIncomeCents: 0,
          }).run()
        }
      }
    })
  } catch (e) {
    if (/UNIQUE constraint failed: users\.email/.test((e as Error).message)) return NextResponse.json({ error: "Un compte existe déjà avec cette adresse e-mail." }, { status: 409 })
    throw e
  }

  return NextResponse.json({ data: { ok: true } })
}
