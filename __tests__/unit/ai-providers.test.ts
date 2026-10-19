import { describe, expect, it } from "vitest"
import { isAuthFailure, parseModels, pickModel, textFromSse } from "@/lib/server/ai-providers"

describe("choix automatique du modèle", () => {
  it("Claude : dernier Sonnet disponible, à défaut Opus puis Haiku", () => {
    const models = [
      { id: "claude-haiku-5-5", created: 300 }, { id: "claude-sonnet-4-5", created: 100 },
      { id: "claude-sonnet-5-5", created: 200 }, { id: "claude-opus-5-5", created: 250 },
    ]
    expect(pickModel("anthropic", models)).toBe("claude-sonnet-5-5")
    expect(pickModel("anthropic", models.filter((m) => !m.id.includes("sonnet")))).toBe("claude-opus-5-5")
    expect(pickModel("anthropic", models.filter((m) => m.id.includes("haiku")))).toBe("claude-haiku-5-5")
    expect(pickModel("anthropic", [])).toBe("claude-sonnet-5-5") // repli
  })
  it("ChatGPT : dernière génération gpt-N, sans mini/audio/image/aperçu/versions datées", () => {
    const ids = ["gpt-4o", "gpt-4.1", "gpt-5", "gpt-5-mini", "gpt-5-2025-08-07", "gpt-4o-audio-preview", "gpt-image-1", "text-embedding-3-large", "o3"]
    expect(pickModel("openai", ids.map((id) => ({ id })))).toBe("gpt-5")
    expect(pickModel("openai", [])).toBe("gpt-4.1")
  })
  it("Gemini : dernier modèle « pro » stable", () => {
    const ids = ["gemini-1.5-pro", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-pro-preview", "gemini-2.0-pro-exp", "gemini-2.5-pro-vision"]
    expect(pickModel("gemini", ids.map((id) => ({ id })))).toBe("gemini-2.5-pro")
    expect(pickModel("gemini", [])).toBe("gemini-2.5-pro")
  })
})

describe("lecture des réponses des fournisseurs", () => {
  it("normalise la liste des modèles de chaque fournisseur", () => {
    expect(parseModels("openai", { data: [{ id: "gpt-5", created: 5 }] })).toEqual([{ id: "gpt-5", created: 5 }])
    expect(parseModels("anthropic", { data: [{ id: "claude-sonnet-5-5", created_at: "2026-01-01T00:00:00Z" }] })[0].created).toBeGreaterThan(0)
    expect(parseModels("gemini", { models: [{ name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }, { name: "models/embedding-001", supportedGenerationMethods: ["embedContent"] }] }))
      .toEqual([{ id: "gemini-2.5-pro" }])
  })
  it("extrait le texte des flux OpenAI et Gemini", () => {
    expect(textFromSse("openai", JSON.stringify({ choices: [{ delta: { content: "Bonjour" } }] }))).toBe("Bonjour")
    expect(textFromSse("openai", "[DONE]")).toBeNull()
    expect(textFromSse("gemini", JSON.stringify({ candidates: [{ content: { parts: [{ text: "A" }, { text: "B" }] } }] }))).toBe("AB")
    expect(textFromSse("gemini", "pas du json")).toBeNull()
  })
  it("distingue une clé refusée d'une indisponibilité", () => {
    expect([401, 403, 400].every(isAuthFailure)).toBe(true)
    expect([429, 500, 502].some(isAuthFailure)).toBe(false)
  })
})
