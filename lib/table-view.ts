// Tri et filtrage de tableaux : fonctions pures (testées), utilisées par le hook useTableView.

export type Cell = string | number | null | undefined
export type SortDir = "asc" | "desc"
export interface SortState { key: string; dir: SortDir }

/** Texte comparable : minuscules, sans accents ni espaces multiples (insensible à la casse et aux accents). */
export const normalizeText = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

/** Ordre de tri : nombres entre eux numériquement, textes en ordre naturel français (« 2 » avant « 10 »), valeurs vides toujours à la fin. */
export function compareCells(a: Cell, b: Cell): number {
  const empty = (v: Cell) => v === null || v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v))
  if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : empty(a) ? 1 : -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "fr", { numeric: true, sensitivity: "base" })
}

/** Trie sans modifier l'original ; l'ordre d'origine départage les égalités (tri stable). `null` = ordre d'origine. */
export function sortRows<T>(rows: T[], getters: Record<string, (r: T) => Cell>, sort: SortState | null): T[] {
  const get = sort ? getters[sort.key] : undefined
  if (!sort || !get) return rows
  const sign = sort.dir === "asc" ? 1 : -1
  return rows.map((r, i) => ({ r, i, v: get(r) })).sort((x, y) => {
    const xe = x.v === null || x.v === undefined || x.v === "", ye = y.v === null || y.v === undefined || y.v === ""
    if (xe || ye) return compareCells(x.v, y.v) || x.i - y.i // vides toujours en dernier, quel que soit le sens
    return sign * compareCells(x.v, y.v) || x.i - y.i
  }).map((x) => x.r)
}

/** Garde les lignes dont une colonne contient tous les mots saisis (ET, insensible casse/accents). */
export function filterRows<T>(rows: T[], getters: Record<string, (r: T) => Cell>, query: string, keys?: string[]): T[] {
  const words = normalizeText(query).split(" ").filter(Boolean)
  if (!words.length) return rows
  const cols = (keys ?? Object.keys(getters)).map((k) => getters[k]).filter(Boolean)
  return rows.filter((r) => {
    const hay = normalizeText(cols.map((g) => g(r)).filter((v) => v !== null && v !== undefined).join(" "))
    return words.every((w) => hay.includes(w))
  })
}

/** Clic sur un en-tête : croissant → décroissant → ordre d'origine. */
export function nextSort(current: SortState | null, key: string): SortState | null {
  if (!current || current.key !== key) return { key, dir: "asc" }
  return current.dir === "asc" ? { key, dir: "desc" } : null
}
