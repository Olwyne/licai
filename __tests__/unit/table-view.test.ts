import { describe, expect, it } from "vitest"
import { compareCells, filterRows, nextSort, normalizeText, sortRows } from "@/lib/table-view"

type R = { id: number; name: string; value: number | null; note?: string }
const rows: R[] = [
  { id: 1, name: "Élan Banque", value: 1200 },
  { id: 2, name: "boursorama 10", value: 80 },
  { id: 3, name: "Boursorama 2", value: null },
  { id: 4, name: "Zèbre", value: 80, note: "à revoir" },
]
const cols = { name: (r: R) => r.name, value: (r: R) => r.value, note: (r: R) => r.note }

describe("tri", () => {
  it("trie les nombres numériquement et les textes en ordre naturel, insensible aux accents et à la casse", () => {
    expect(sortRows(rows, cols, { key: "value", dir: "asc" }).map((r) => r.id)).toEqual([2, 4, 1, 3])
    expect(sortRows(rows, cols, { key: "name", dir: "asc" }).map((r) => r.id)).toEqual([3, 2, 1, 4]) // « Boursorama 2 » avant « 10 », « Élan » après
    expect(sortRows(rows, cols, { key: "name", dir: "desc" }).map((r) => r.id)).toEqual([4, 1, 2, 3])
  })
  it("garde les valeurs vides à la fin quel que soit le sens, et l'ordre d'origine entre égalités", () => {
    expect(sortRows(rows, cols, { key: "value", dir: "desc" }).map((r) => r.id)).toEqual([1, 2, 4, 3]) // 2 et 4 (80) restent dans l'ordre d'origine
    expect(sortRows(rows, cols, { key: "note", dir: "asc" }).map((r) => r.id)).toEqual([4, 1, 2, 3])
  })
  it("ne modifie pas le tableau d'origine et ignore un tri absent ou inconnu", () => {
    const copy = [...rows]
    sortRows(rows, cols, { key: "value", dir: "asc" })
    expect(rows).toEqual(copy)
    expect(sortRows(rows, cols, null)).toBe(rows)
    expect(sortRows(rows, cols, { key: "inconnue", dir: "asc" })).toBe(rows)
  })
  it("compareCells : nombres, textes et vides", () => {
    expect(compareCells(2, 10)).toBeLessThan(0)
    expect(compareCells("a2", "a10")).toBeLessThan(0)
    expect(compareCells(null, 1)).toBeGreaterThan(0)
    expect(compareCells(NaN, "x")).toBeGreaterThan(0)
    expect(compareCells(undefined, null)).toBe(0)
  })
  it("le clic sur un en-tête fait défiler croissant, décroissant, ordre d'origine", () => {
    const a = nextSort(null, "value")
    expect(a).toEqual({ key: "value", dir: "asc" })
    const b = nextSort(a, "value")
    expect(b).toEqual({ key: "value", dir: "desc" })
    expect(nextSort(b, "value")).toBeNull()
    expect(nextSort(b, "name")).toEqual({ key: "name", dir: "asc" })
  })
})

describe("filtre", () => {
  it("ignore casse et accents, et exige tous les mots (dans n'importe quelle colonne)", () => {
    expect(filterRows(rows, cols, "elan").map((r) => r.id)).toEqual([1])
    expect(filterRows(rows, cols, "BOURSORAMA").map((r) => r.id)).toEqual([2, 3])
    expect(filterRows(rows, cols, "zebre revoir").map((r) => r.id)).toEqual([4]) // mots dans deux colonnes
    expect(filterRows(rows, cols, "zebre inconnu")).toEqual([])
    expect(filterRows(rows, cols, "80").map((r) => r.id)).toEqual([2, 4])
  })
  it("une recherche vide garde tout ; `keys` restreint les colonnes cherchées", () => {
    expect(filterRows(rows, cols, "  ")).toBe(rows)
    expect(filterRows(rows, cols, "revoir", ["name"])).toEqual([])
    expect(normalizeText("  Éléphant   ROSE ")).toBe("elephant rose")
  })
})
