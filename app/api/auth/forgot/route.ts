import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { createHash, randomBytes, randomUUID } from "crypto"
import { db } from "@/lib/db"
import { passwordResets, users } from "@/db/schema"
import { sendMail } from "@/lib/mailer"

// Réponse identique que le compte existe ou non (pas d'énumération d'adresses).
export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string }
  const user = email ? db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).get() : undefined
  if (user) {
    const token = randomBytes(32).toString("hex")
    db.insert(passwordResets).values({
      id: randomUUID(), userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }).run()
    const origin = process.env.NEXTAUTH_URL ?? new URL(req.url).origin
    try {
      await sendMail(user.email, "Réinitialisation de votre mot de passe Lǐcái",
        `Pour choisir un nouveau mot de passe (lien valable 1 heure) :\n${origin}/reset-password?token=${token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`)
    } catch (e) {
      console.error("[forgot] envoi impossible", (e as Error).message) // réponse inchangée : pas d'énumération
    }
  }
  return NextResponse.json({ data: { ok: true } })
}
