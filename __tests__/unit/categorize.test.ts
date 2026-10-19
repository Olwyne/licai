import { describe, expect, it } from "vitest"
import { categorizationPrompt, normalizeMerchant, parseCategorization, suggestFromHistory, type CatTx } from "@/lib/finance/categorize"

const tx = (id: string, name: string, categoryId: string | null, amountCents = -1500): CatTx => ({ id, name, categoryId, amountCents })

describe("normalisation des commerçants", () => {
  it("ignore la casse, les accents, les chiffres, les dates et les mots génériques de relevé", () => {
    expect(normalizeMerchant("CB CARREFOUR MARKET 4521 12/10")).toBe("carrefour market")
    expect(normalizeMerchant("Prélèvement Électricité de France")).toBe("electricite de france")
    expect(normalizeMerchant("PAIEMENT CB Boulangerie Paul 08/10")).toBe("boulangerie paul")
  })
})

describe("suggestion depuis l'historique", () => {
  const known = [tx("1", "Carrefour Market", "cat-food"), tx("2", "CB CARREFOUR MARKET 4521", "cat-food"), tx("3", "Uber", "cat-transport"), tx("4", "Uber", "cat-leisure"), tx("5", "Uber", "cat-transport")]
  it("reprend la catégorie dominante du même commerçant", () => {
    const s = suggestFromHistory([tx("a", "carrefour market 0099", null)], known)
    expect(s).toEqual([{ id: "a", categoryId: "cat-food", source: "history", confidence: 1 }])
  })
  it("réduit la confiance quand l'historique est partagé et ignore les commerçants inconnus", () => {
    const [u] = suggestFromHistory([tx("b", "Uber", null)], known)
    expect(u.categoryId).toBe("cat-transport")
    expect(u.confidence).toBeCloseTo(0.67, 2)
    expect(suggestFromHistory([tx("c", "Boutique inconnue", null)], known)).toEqual([])
    expect(suggestFromHistory([tx("d", "Uber", null)], known, 0.9)).toEqual([])
  })
  it("un seul exemple donne 0,75", () => {
    expect(suggestFromHistory([tx("e", "Netflix", null)], [tx("9", "NETFLIX", "cat-leisure")])[0].confidence).toBe(0.75)
  })
})

describe("réponse de l'IA", () => {
  const cats = new Set(["cat-food", "cat-transport"]); const ids = new Set(["a", "b", "c"])
  it("accepte du JSON entouré de texte, écarte les catégories et transactions inconnues, et les doublons", () => {
    const text = 'Voici :\n```json\n[{"id":"a","categoryId":"cat-food","confidence":0.9},{"id":"b","categoryId":"inconnue"},{"id":"zzz","categoryId":"cat-food"},{"id":"a","categoryId":"cat-transport"},{"id":"c","categoryId":"cat-transport","confidence":7}]\n```'
    expect(parseCategorization(text, cats, ids)).toEqual([
      { id: "a", categoryId: "cat-food", source: "ai", confidence: 0.9 },
      { id: "c", categoryId: "cat-transport", source: "ai", confidence: 0.5 },
    ])
  })
  it("renvoie une liste vide pour une réponse illisible", () => {
    expect(parseCategorization("désolé, je ne peux pas", cats, ids)).toEqual([])
    expect(parseCategorization("[pas du json]", cats, ids)).toEqual([])
  })
  it("le message envoyé ne contient que les catégories et les libellés/montants nécessaires", () => {
    const p = categorizationPrompt([{ id: "cat-food", label: "Alimentation" }], [tx("a", "Carrefour", null, -2345)])
    expect(JSON.parse(p.user)).toEqual({ categories: [{ categoryId: "cat-food", label: "Alimentation" }], transactions: [{ id: "a", libelle: "Carrefour", montant: -23.45 }] })
    expect(p.system).toMatch(/UNIQUEMENT/)
  })
})
