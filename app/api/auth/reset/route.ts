import { NextResponse } from "next/server"
import { and, eq, gt, isNull } from "drizzle-orm"
import { createHash } from "crypto"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { passwordResets, users } from "@/db/schema"
import { passwordIssue } from "@/lib/password"

export async function POST(req: Request) {
  const { token, password } = (await req.json()) as { token?: string; password?: string }
  if (!token || !password) return NextResponse.json({ error: "Champs manquants." }, { status: 400 })
  const issue = passwordIssue(password)
  if (issue) return NextResponse.json({ error: issue }, { status: 400 })

  const tokenHash = createHash("sha256").update(token).digest("hex")
  const reset = db.select().from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
    .get()
  if (!reset) return NextResponse.json({ error: "Lien invalide ou expiré. Refaites une demande." }, { status: 400 })

  db.update(users).set({ passwordHash: await bcrypt.hash(password, 12) }).where(eq(users.id, reset.userId)).run()
  db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id)).run()
  return NextResponse.json({ data: { ok: true } })
}
