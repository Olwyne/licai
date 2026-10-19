import { getHouseholdId } from "@/lib/api"
import { resolveAi } from "@/lib/server/ai-key"
import { AiHttpError, effectiveModel, streamChat, type ChatMessage } from "@/lib/server/ai-client"
import { ASSISTANT_SYSTEM, buildAssistantSnapshot } from "@/lib/server/assistant-snapshot"

const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return new Response("Unauthorized", { status: 401 })

  const ai = resolveAi(householdId)
  if (!ai.key) return json({ error: "Aucune clé API configurée." }, 503)

  try {
    const { messages } = (await req.json()) as { messages: ChatMessage[] }
    if (!Array.isArray(messages) || messages.length > 50) return json({ error: "Too many messages" }, 400)

    const system = `${ASSISTANT_SYSTEM}\n\nDonnées du foyer (JSON) :\n${JSON.stringify(buildAssistantSnapshot(householdId))}`
    const model = await effectiveModel(ai.provider, ai.key, ai.model)
    const chunks = streamChat({ provider: ai.provider, key: ai.key, model, system, messages: messages.map((m) => ({ role: m.role, content: m.content })) })
    const encoder = new TextEncoder()

    // On lit le premier fragment avant de répondre : une clé refusée ou un modèle inconnu donne une vraie erreur HTTP.
    const first = await chunks.next()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (!first.done) controller.enqueue(encoder.encode(`data: ${JSON.stringify(first.value)}\n\n`))
          for await (const text of chunks) controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        } finally {
          controller.close()
        }
      },
    })
    return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } })
  } catch (error) {
    if (error instanceof AiHttpError || (error as { status?: number }).status) {
      const status = (error as { status?: number }).status ?? 502
      const msg = status === 401 || status === 403 ? "clé API refusée par le fournisseur" : status === 404 ? "modèle introuvable chez le fournisseur" : status === 429 ? "quota ou limite de requêtes atteint chez le fournisseur" : `erreur du fournisseur (HTTP ${status})`
      return json({ error: msg }, 502)
    }
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500)
  }
}
