import Anthropic from "@anthropic-ai/sdk"
import { getHouseholdId } from "@/lib/api"
import { ASSISTANT_SYSTEM, buildAssistantSnapshot } from "@/lib/server/assistant-snapshot"

const client = new Anthropic()

type MessageParam = {
  role: "user" | "assistant"
  content: string
}

export async function POST(req: Request) {
  const householdId = await getHouseholdId()
  if (!householdId) return new Response("Unauthorized", { status: 401 })

  try {
    const body = (await req.json()) as { messages: MessageParam[] }
    const { messages } = body
    if (!Array.isArray(messages) || messages.length > 50) {
      return new Response(JSON.stringify({ error: "Too many messages" }), { status: 400 })
    }

    const systemPrompt = `${ASSISTANT_SYSTEM}\n\nDonnées du foyer (JSON) :\n${JSON.stringify(buildAssistantSnapshot(householdId))}`

    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event.delta.text)}\n\n`))
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error"
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
