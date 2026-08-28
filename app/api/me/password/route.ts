import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { users } from "@/db/schema"
import { eq } from "drizzle-orm"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
  }

  const body = (await req.json()) as { currentPassword?: string; newPassword?: string }
  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "Champs manquants" }, { status: 400 })
  }
  if (body.newPassword.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères" }, { status: 400 })
  }

  let user
  try {
    user = db.select().from(users).where(eq(users.email, session.user.email)).get()
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
  }

  if (user.householdId !== session.user.householdId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 })
  }

  const valid = await bcrypt.compare(body.currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 })
  }

  const newHash = await bcrypt.hash(body.newPassword, 12)
  let result
  try {
    result = db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id)).run()
  } catch {
    return NextResponse.json({ error: "Database error" }, { status: 500 })
  }
  if (result.changes === 0) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
