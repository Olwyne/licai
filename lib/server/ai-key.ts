import { db } from "@/lib/db"
import { households } from "@/db/schema"
import { eq } from "drizzle-orm"
import { decryptSecret } from "./secret"
import { PROVIDERS, PROVIDER_IDS, isProvider, type AiProvider } from "./ai-providers"

export type AiKeySource = "account" | "server" | "none"
export interface ResolvedAi { key: string | null; source: AiKeySource; /** Une clé est enregistrée mais illisible (le secret du serveur a changé). */ unreadable: boolean; provider: AiProvider; /** Modèle choisi dans les paramètres ; vide = automatique. */ model: string }

/**
 * Configuration IA du foyer : clé + fournisseur + modèle saisis dans les paramètres du compte ;
 * à défaut, la première clé fournie par le serveur (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY).
 */
export function resolveAi(householdId: string): ResolvedAi {
  const hh = db.select({ k: households.aiKeyEnc, p: households.aiProvider, m: households.aiModel }).from(households).where(eq(households.id, householdId)).get()
  const provider: AiProvider = isProvider(hh?.p) ? hh.p : "anthropic"
  const own = hh?.k ? decryptSecret(hh.k) : null
  const unreadable = Boolean(hh?.k) && !own
  if (own) return { key: own, source: "account", unreadable: false, provider, model: hh?.m ?? "" }
  for (const id of PROVIDER_IDS) {
    const env = process.env[PROVIDERS[id].env]?.trim()
    if (env) return { key: env, source: "server", unreadable, provider: id, model: "" }
  }
  return { key: null, source: "none", unreadable, provider, model: hh?.m ?? "" }
}

/** Fin de la clé pour l'affichage (jamais la clé entière). */
export const keyHint = (k: string | null): string => (k ? `…${k.slice(-4)}` : "")
