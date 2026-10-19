import { db } from "@/lib/db"
import { sql } from "drizzle-orm"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Contrôle d'état (conteneur, supervision) : public, ne révèle aucune donnée. 200 si la base répond, 503 sinon.
export async function GET() {
  try {
    db.get(sql`select 1`)
    return NextResponse.json({ status: "ok" })
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}
