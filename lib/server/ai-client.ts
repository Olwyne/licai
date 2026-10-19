import Anthropic from "@anthropic-ai/sdk"
import { PROVIDERS, parseModels, pickModel, textFromSse, type AiProvider, type ModelInfo } from "./ai-providers"

export type ChatMessage = { role: "user" | "assistant"; content: string }

const TIMEOUT_MS = 8000

function modelsRequest(provider: AiProvider, key: string): { url: string; init: RequestInit } {
  if (provider === "anthropic") return { url: "https://api.anthropic.com/v1/models?limit=100", init: { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } } }
  if (provider === "openai") return { url: "https://api.openai.com/v1/models", init: { headers: { Authorization: `Bearer ${key}` } } }
  return { url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", init: { headers: { "x-goog-api-key": key } } }
}

export class AiHttpError extends Error { constructor(public status: number, msg: string) { super(msg) } }

/** Liste des modèles accessibles avec cette clé (sert aussi à vérifier la clé). */
export async function listModels(provider: AiProvider, key: string): Promise<ModelInfo[]> {
  const { url, init } = modelsRequest(provider, key)
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!res.ok) throw new AiHttpError(res.status, `HTTP ${res.status}`)
  return parseModels(provider, await res.json())
}

const cache = new Map<string, { model: string; at: number }>()

/** Modèle à utiliser : celui choisi dans les paramètres, sinon le plus pertinent parmi ceux du compte (mis en cache 1 h). */
export async function effectiveModel(provider: AiProvider, key: string, chosen: string): Promise<string> {
  if (chosen) return chosen
  const ck = `${provider}:${key.slice(-8)}`
  const hit = cache.get(ck)
  if (hit && Date.now() - hit.at < 3600_000) return hit.model
  let model = PROVIDERS[provider].fallbackModel
  try { model = pickModel(provider, await listModels(provider, key)) } catch { /* liste indisponible : modèle de repli */ }
  cache.set(ck, { model, at: Date.now() })
  return model
}

/** Réponse en flux de fragments de texte, quel que soit le fournisseur. */
export async function* streamChat(opts: { provider: AiProvider; key: string; model: string; system: string; messages: ChatMessage[] }): AsyncGenerator<string> {
  const { provider, key, model, system, messages } = opts
  if (provider === "anthropic") {
    const stream = new Anthropic({ apiKey: key }).messages.stream({ model, max_tokens: 1500, system, messages })
    for await (const ev of stream) if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text
    return
  }
  const res = provider === "openai"
    ? await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, stream: true, messages: [{ role: "system", content: system }, ...messages] }),
      })
    : await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        }),
      })
  if (!res.ok || !res.body) throw new AiHttpError(res.status, `HTTP ${res.status}`)
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const events = buf.split("\n\n"); buf = events.pop() ?? ""
    for (const ev of events) {
      const line = ev.split("\n").find((l) => l.startsWith("data:"))
      const t = line ? textFromSse(provider, line.slice(5).trim()) : null
      if (t) yield t
    }
  }
}
