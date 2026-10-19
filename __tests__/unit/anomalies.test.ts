import { describe, expect, it } from "vitest"
import { detectAnomalies, type AnomalyInput, type AnomalyTx } from "@/lib/finance/anomalies"

const TODAY = "2026-10-19"
const cats = new Map([["food", { label: "Alimentation", icon: "ti-shopping-cart" }]])
const t = (id: string, name: string, amount: number, date: string, categoryId: string | null = null): AnomalyTx => ({ id, name, amount, date, categoryId })
const base = (over: Partial<AnomalyInput>): AnomalyInput => ({ today: TODAY, txs: [], recurring: [], categories: cats, ...over })

describe("abonnements en double", () => {
  it("détecte deux abonnements actifs au nom identique ou quasi identique", () => {
    const a = detectAnomalies(base({ recurring: [
      { id: "1", name: "Netflix", amount: 13.49, frequency: "monthly", kind: "subscription", active: true },
      { id: "2", name: "NETFLIX Premium", amount: 17.99, frequency: "monthly", kind: "subscription", active: true },
      { id: "3", name: "Spotify", amount: 10.99, frequency: "monthly", kind: "subscription", active: true },
    ] }))
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ kind: "anomalie", title: "Abonnement en double : Netflix" })
    expect(a[0].text).toContain("162")
  })
  it("ignore les abonnements inactifs et les noms différents", () => {
    expect(detectAnomalies(base({ recurring: [
      { id: "1", name: "Netflix", amount: 13, frequency: "monthly", kind: "subscription", active: true },
      { id: "2", name: "Netflix", amount: 13, frequency: "monthly", kind: "subscription", active: false },
      { id: "3", name: "Canal Plus", amount: 20, frequency: "monthly", kind: "subscription", active: true },
    ] }))).toEqual([])
  })
  it("détecte un double débit à quelques jours d'intervalle, pas un prélèvement mensuel", () => {
    const double = detectAnomalies(base({ txs: [t("a", "Salle de sport", 39.9, "2026-10-10"), t("b", "Salle de sport", 39.9, "2026-10-12")] }))
    expect(double.map((x) => x.title)).toEqual(["Double débit possible : Salle de sport"])
    expect(detectAnomalies(base({ txs: [t("a", "Salle de sport", 39.9, "2026-09-12"), t("b", "Salle de sport", 39.9, "2026-10-12")] }))).toEqual([])
  })
})

describe("hausse d'un prélèvement", () => {
  const series = (last: number) => [t("1", "Free Mobile", 19.99, "2026-07-05"), t("2", "Free Mobile", 19.99, "2026-08-05"), t("3", "Free Mobile", 19.99, "2026-09-05"), t("4", "Free Mobile", last, "2026-10-05")]
  it("signale un dernier montant supérieur de plus de 10 % à l'habituel", () => {
    const [a] = detectAnomalies(base({ txs: series(24.99) }))
    expect(a).toMatchObject({ kind: "anomalie", title: "Hausse de prélèvement : Free Mobile", tone: "high" })
    expect(a.text).toContain("+25 %")
  })
  it("ne signale rien pour une variation faible ou un montant stable", () => {
    expect(detectAnomalies(base({ txs: series(20.99) }))).toEqual([])
    expect(detectAnomalies(base({ txs: series(19.99) }))).toEqual([])
  })
  it("ignore les achats irréguliers", () => {
    expect(detectAnomalies(base({ txs: [t("1", "Boulangerie", 3, "2026-09-01"), t("2", "Boulangerie", 3.2, "2026-09-03"), t("3", "Boulangerie", 8, "2026-10-17")] }))).toEqual([])
  })
})

describe("dépense inhabituelle", () => {
  const history = ["2026-04-10", "2026-05-12", "2026-06-09", "2026-07-11", "2026-08-08", "2026-09-05"].map((d, i) => t(`h${i}`, "Courses", 60 + i * 5, d, "food"))
  it("signale une dépense récente très supérieure à l'habitude de la catégorie", () => {
    const [a] = detectAnomalies(base({ txs: [...history, t("big", "Traiteur", 480, "2026-10-12", "food")] }))
    expect(a).toMatchObject({ id: "an-out-big", title: "Dépense inhabituelle : Traiteur", icon: "ti-shopping-cart" })
    expect(a.text).toContain("Alimentation")
  })
  it("ne signale pas une dépense normale ni une catégorie sans historique suffisant", () => {
    expect(detectAnomalies(base({ txs: [...history, t("ok", "Courses", 95, "2026-10-12", "food")] }))).toEqual([])
    expect(detectAnomalies(base({ txs: [t("h", "Courses", 60, "2026-09-01", "food"), t("big", "Traiteur", 480, "2026-10-12", "food")] }))).toEqual([])
  })
})
