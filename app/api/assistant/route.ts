import Anthropic from "@anthropic-ai/sdk"
import { db } from "@/lib/db"
import { accounts, members, transactions, budgets, goals } from "@/db/schema"
import { eq } from "drizzle-orm"
import { getHouseholdId } from "@/lib/api"

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

    const currentMonth = new Date().toISOString().slice(0, 7)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    // Load financial context (sync Drizzle)
    const accountRows = db
      .select({ id: accounts.id, name: accounts.name, type: accounts.type, balanceCents: accounts.balanceCents })
      .from(accounts)
      .where(eq(accounts.householdId, householdId))
      .all()

    const recentTx = db
      .select({ name: transactions.name, amountCents: transactions.amountCents, date: transactions.date, categoryId: transactions.categoryId })
      .from(transactions)
      .where(eq(transactions.householdId, householdId))
      .all()
      .filter((t) => t.date >= thirtyDaysAgo)
      .slice(0, 50)

    const memberRows = db
      .select({ name: members.name, monthlyIncomeCents: members.monthlyIncomeCents })
      .from(members)
      .where(eq(members.householdId, householdId))
      .all()

    const budgetRows = db
      .select({ limitCents: budgets.limitCents, categoryId: budgets.categoryId })
      .from(budgets)
      .where(eq(budgets.householdId, householdId))
      .all()
      .filter((b) => b.categoryId !== null)

    const goalRows = db
      .select({ name: goals.name, targetCents: goals.targetCents, currentCents: goals.currentCents })
      .from(goals)
      .where(eq(goals.householdId, householdId))
      .all()

    const systemPrompt = `Tu es un assistant financier personnel pour le foyer. Tu réponds en français, de façon concise et utile.

Contexte financier actuel (${currentMonth}):

COMPTES:
${accountRows.map((a) => `- ${a.name} (${a.type}): ${(a.balanceCents / 100).toFixed(2)} €`).join("\n")}

MEMBRES DU FOYER:
${memberRows.map((m) => `- ${m.name}: ${(m.monthlyIncomeCents / 100).toFixed(2)} €/mois`).join("\n")}

OBJECTIFS D'ÉPARGNE:
${goalRows.map((g) => `- ${g.name}: ${(g.currentCents / 100).toFixed(2)} / ${(g.targetCents / 100).toFixed(2)} €`).join("\n")}

DERNIÈRES TRANSACTIONS (30j):
${recentTx.map((t) => `- ${t.date} ${t.name}: ${(t.amountCents / 100).toFixed(2)} €`).join("\n")}

Réponds de façon précise aux questions sur les finances du foyer.`

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
              controller.enqueue(encoder.encode(`data: ${event.delta.text}\n\n`))
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
