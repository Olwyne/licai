// Fournisseurs d'IA pris en charge par l'assistant, sélection automatique du modèle et lecture des flux de réponse.
// Fonctions pures (testables) : les appels réseau sont faits par les routes.

export type AiProvider = "anthropic" | "openai" | "gemini"

export interface ProviderDef {
  id: AiProvider
  label: string
  /** Préfixe usuel de la clé (indication de saisie). */
  keyHint: string
  /** Modèle de repli si la liste des modèles du compte est indisponible. */
  fallbackModel: string
  /** Variable d'environnement serveur reconnue. */
  env: string
}

export const PROVIDERS: Record<AiProvider, ProviderDef> = {
  anthropic: { id: "anthropic", label: "Claude (Anthropic)", keyHint: "sk-ant-…", fallbackModel: "claude-sonnet-5-5", env: "ANTHROPIC_API_KEY" },
  openai: { id: "openai", label: "ChatGPT (OpenAI)", keyHint: "sk-…", fallbackModel: "gpt-4.1", env: "OPENAI_API_KEY" },
  gemini: { id: "gemini", label: "Gemini (Google)", keyHint: "AIza…", fallbackModel: "gemini-2.5-pro", env: "GEMINI_API_KEY" },
}
export const PROVIDER_IDS = Object.keys(PROVIDERS) as AiProvider[]
export const isProvider = (v: unknown): v is AiProvider => typeof v === "string" && v in PROVIDERS

export interface ModelInfo { id: string; created?: number }

/** Suite de nombres d'un identifiant de modèle, pour comparer les versions (gpt-5.1 > gpt-4.1 > gpt-4o…). */
const version = (id: string): number[] => (id.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
function cmpVersion(a: string, b: string): number {
  const va = version(a), vb = version(b)
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (va[i] ?? 0) - (vb[i] ?? 0)
    if (d) return d
  }
  return 0
}
const newest = (models: ModelInfo[]): ModelInfo | undefined =>
  [...models].sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || cmpVersion(b.id, a.id))[0]
const best = (models: ModelInfo[]): ModelInfo | undefined =>
  [...models].sort((a, b) => cmpVersion(b.id, a.id) || (b.created ?? 0) - (a.created ?? 0))[0]

/**
 * Modèle le plus pertinent pour analyser des finances personnelles : raisonnement fort et réponses chiffrées fiables,
 * à coût raisonnable pour un usage conversationnel — la dernière génération « intermédiaire/pro », hors variantes
 * spécialisées (audio, image, embeddings, aperçus, mini/nano).
 */
export function pickModel(provider: AiProvider, models: ModelInfo[]): string {
  const fallback = PROVIDERS[provider].fallbackModel
  if (provider === "anthropic") {
    const ok = models.filter((m) => /^claude-/.test(m.id))
    // Sonnet : meilleur compromis analyse / coût ; à défaut Opus, puis Haiku.
    for (const family of ["sonnet", "opus", "haiku"]) {
      const pick = newest(ok.filter((m) => m.id.includes(family)))
      if (pick) return pick.id
    }
    return fallback
  }
  if (provider === "openai") {
    const ok = models.filter((m) => /^gpt-\d/.test(m.id) && !/(mini|nano|audio|realtime|image|tts|transcribe|search|instruct|codex|preview|\d{4}-\d{2}-\d{2}|chat-latest)/.test(m.id))
    return best(ok)?.id ?? fallback
  }
  const ok = models.filter((m) => /^gemini-\d/.test(m.id) && /-pro(-latest)?$/.test(m.id) && !/(vision|image|tts|live|exp|preview|thinking)/.test(m.id))
  return best(ok)?.id ?? fallback
}

/** Réponse de la liste des modèles d'un fournisseur → liste normalisée (chat uniquement). */
export function parseModels(provider: AiProvider, json: unknown): ModelInfo[] {
  const j = json as { data?: { id?: string; created_at?: string; created?: number }[]; models?: { name?: string; supportedGenerationMethods?: string[] }[] }
  if (provider === "gemini") {
    return (j.models ?? [])
      .filter((m) => m.name && (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => ({ id: m.name!.replace(/^models\//, "") }))
  }
  return (j.data ?? []).filter((m) => m.id).map((m) => ({
    id: m.id!,
    created: provider === "anthropic" ? (m.created_at ? Date.parse(m.created_at) / 1000 : undefined) : m.created,
  }))
}

/** Un événement SSE `data: …` d'OpenAI ou de Gemini → fragment de texte (ou null). */
export function textFromSse(provider: "openai" | "gemini", data: string): string | null {
  if (data === "[DONE]") return null
  try {
    const j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[]; candidates?: { content?: { parts?: { text?: string }[] } }[] }
    if (provider === "openai") return j.choices?.[0]?.delta?.content ?? null
    return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("") || null
  } catch { return null }
}

/** Les clés refusées (401/403, ou 400 chez Google) sont des erreurs d'authentification ; le reste est une indisponibilité. */
export const isAuthFailure = (status: number): boolean => status === 401 || status === 403 || status === 400
