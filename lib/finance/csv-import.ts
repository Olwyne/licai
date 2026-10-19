// Import de relevés bancaires : lecture robuste du CSV (encodage, guillemets, lignes d'en-tête de la banque), formats de date et de
// montant variés, et « modèles » enregistrés qui décrivent à quoi correspond chaque colonne d'une banque donnée. Fonctions pures.

export interface ParsedRow { date: string; name: string; amountCents: number }

export const DATE_FORMATS = ["DD/MM/YYYY", "DD/MM/YY", "MM/DD/YYYY", "YYYY-MM-DD", "YYYY/MM/DD", "DD-MM-YYYY", "DD.MM.YYYY"] as const
export type DateFormat = (typeof DATE_FORMATS)[number]
export const SEPARATORS = [";", ",", "\t", "|"] as const

/** Réglages d'un export bancaire : colonnes, séparateur, formats, lignes à ignorer avant l'en-tête. */
export interface CsvTemplate {
  name: string
  bankId: string | null
  separator: string
  decimal: "," | "."
  dateFormat: DateFormat
  skipLines: number
  amountMode: "single" | "split"
  dateCol: string
  labelCol: string
  amountCol: string
  debitCol: string
  creditCol: string
  /** Export où les dépenses sont positives (cartes de crédit…) : on inverse le signe de la colonne montant. */
  invertSign: boolean
}

export const DEFAULT_TEMPLATE: CsvTemplate = {
  name: "", bankId: null, separator: ";", decimal: ",", dateFormat: "DD/MM/YYYY", skipLines: 0, amountMode: "split",
  dateCol: "", labelCol: "", amountCol: "", debitCol: "", creditCol: "", invertSign: false,
}

// ── Lecture du fichier ───────────────────────────────────────────────────────

/** Texte d'un fichier : UTF-8 (BOM retiré), à défaut Windows-1252 (exports de nombreuses banques françaises). */
export function decodeCsv(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start)) } catch { /* pas de l'UTF-8 */ }
  return new TextDecoder("windows-1252").decode(bytes.subarray(start))
}

/** Séparateur le plus fréquent hors guillemets sur les premières lignes. */
export function detectSeparator(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 8)
  let best = ";", bestScore = -1
  for (const sep of SEPARATORS) {
    const counts = sample.map((l) => tokenizeLine(l, sep).length - 1)
    const consistent = counts.filter((c) => c === counts[Math.min(1, counts.length - 1)] && c > 0).length
    const score = consistent * 100 + Math.max(...counts, 0)
    if (score > bestScore) { bestScore = score; best = sep }
  }
  return best
}

function tokenizeLine(line: string, sep: string): string[] { return tokenizeCsv(line, sep)[0] ?? [""] }

/**
 * CSV → lignes de cellules : guillemets, guillemets doublés (""), séparateur et retours à la ligne dans les guillemets.
 * Les lignes vides sont conservées (`[""]`) pour que les numéros de ligne restent ceux du fichier ouvert dans un éditeur.
 */
export function tokenizeCsv(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = "", quoted = false
  const pushCell = () => { row.push(cell.trim()); cell = "" }
  const pushRow = () => { pushCell(); rows.push(row); row = [] }
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += c
    } else if (c === '"' && cell === "") quoted = true
    else if (c === sep) pushCell()
    else if (c === "\n") pushRow()
    else if (c === "\r") { /* CRLF */ } else cell += c
  }
  if (cell !== "" || row.length) pushRow()
  return rows
}

/** Nombre de lignes de préambule (nom du compte, période, solde…) avant la ligne d'en-tête : première ligne de la largeur dominante. */
export function detectSkipLines(rows: string[][]): number {
  const widths = rows.slice(0, 25).map((r) => r.length)
  const freq = new Map<number, number>()
  for (const w of widths) if (w >= 2) freq.set(w, (freq.get(w) ?? 0) + 1)
  const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0]
  if (!dominant) return 0
  const i = widths.findIndex((w, idx) => w === dominant && widths[idx + 1] === dominant)
  return i < 0 ? 0 : i
}

// ── Dates et montants ────────────────────────────────────────────────────────

const pad = (n: number | string) => String(n).padStart(2, "0")
const valid = (y: number, m: number, d: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= new Date(y, m, 0).getDate()

/** Date → « AAAA-MM-JJ », ou null si elle est invalide pour ce format (ex. 31/02, mois 13). L'heure éventuelle est ignorée. */
export function parseDate(raw: string, fmt: DateFormat): string | null {
  const r = (raw ?? "").trim().split(/[ T]/)[0]
  const parts = r.split(/[/.-]/)
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  let y: number, m: number, d: number
  const [a, b, c] = parts.map(Number)
  if (fmt === "YYYY-MM-DD" || fmt === "YYYY/MM/DD") { y = a; m = b; d = c }
  else if (fmt === "MM/DD/YYYY") { m = a; d = b; y = c }
  else { d = a; m = b; y = c }
  if (fmt === "DD/MM/YY") y += y < 70 ? 2000 : 1900
  return valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null
}

/** Format de date le plus plausible pour des exemples (le français JJ/MM prime quand c'est ambigu). */
export function guessDateFormat(samples: string[]): DateFormat {
  const s = samples.filter((x) => x?.trim()).slice(0, 30)
  if (!s.length) return "DD/MM/YYYY"
  let best: DateFormat = "DD/MM/YYYY", bestOk = -1
  for (const f of DATE_FORMATS) {
    const sepOk = s.filter((x) => (f.includes("/") ? /\//.test(x) : f.includes("-") ? /-/.test(x) : /\./.test(x))).length
    const ok = s.filter((x) => parseDate(x, f) !== null).length
    const score = ok * 2 + (sepOk === s.length ? 1 : 0)
    if (score > bestOk) { bestOk = score; best = f }
  }
  return best
}

/** Montant → centimes. Gère « 1 234,56 », « 1.234,56 », « -12,50 € », « (12,50) », « 12,50- », « +3 », séparateurs insécables. null si illisible. */
export function parseAmount(raw: string, decimal: "," | "." | "auto" = "auto"): number | null {
  let s = (raw ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(/[€$£]|EUR|USD|GBP|CHF/gi, "")
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  if (s.endsWith("-")) { neg = true; s = s.slice(0, -1) }
  if (s.startsWith("-") || s.startsWith("−")) { neg = true; s = s.slice(1) }
  if (s.startsWith("+")) s = s.slice(1)
  let dec: "," | "." = decimal === "auto" ? "." : decimal
  if (decimal === "auto") {
    const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".")
    if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? "," : "."
    else if (lastComma >= 0 || lastDot >= 0) {
      const sepChar = lastComma >= 0 ? "," : "."
      const once = s.split(sepChar).length === 2
      const thousandsOnly = !once || /^\d{1,3}[.,]\d{3}$/.test(s) // « 1.234 » ou « 1.234.567 » : séparateur de milliers
      dec = thousandsOnly ? (sepChar === "," ? "." : ",") : sepChar
    }
  }
  s = s.split(dec === "," ? "." : ",").join("").replace(dec, ".")
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(s)) return null
  const n = Math.round(parseFloat(s) * 100)
  return neg ? -n : n
}

// ── Modèles de colonnes ──────────────────────────────────────────────────────

const norm = (h: string) => h.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

/** Signature d'un en-tête : noms de colonnes normalisés et triés (insensible à la casse, aux accents et à l'ordre). */
export const headerSignature = (headers: string[]): string => headers.map(norm).sort().join("|")

/** Colonnes devinées d'après les noms (date, libellé, montant, débit, crédit). */
export function guessMapping(headers: string[]): Pick<CsvTemplate, "dateCol" | "labelCol" | "amountCol" | "debitCol" | "creditCol" | "amountMode"> {
  // les mots-clés sont essayés dans l'ordre (« libellé » avant « opération », qui apparaît aussi dans « Date opération »)
  const find = (keys: string[], except = "") => { for (const k of keys) { const h = headers.find((x) => x !== except && norm(x).includes(k)); if (h) return h } return "" }
  const dateCol = find(["date"]) || headers[0] || ""
  const debitCol = headers.find((h) => /^(debit|debits|sortie)/.test(norm(h)) || norm(h).includes("debit")) ?? ""
  const creditCol = headers.find((h) => /^(credit|credits|entree)/.test(norm(h)) || norm(h).includes("credit")) ?? ""
  const amountCol = find(["amount", "montant", "somme", "valeur"])
  return {
    dateCol,
    labelCol: find(["libelle", "label", "description", "intitule", "motif", "name", "beneficiaire", "operation"], dateCol) || headers.find((h) => h !== dateCol) || "",
    amountCol, debitCol, creditCol,
    amountMode: debitCol && creditCol ? "split" : "single",
  }
}

/** Modèle enregistré qui correspond à cet en-tête : toutes ses colonnes y figurent ; à défaut de signature exacte, le plus précis. */
export function matchTemplate(templates: (CsvTemplate & { signature?: string })[], headers: string[], bankId?: string | null): CsvTemplate | null {
  const names = new Set(headers.map(norm))
  const cols = (t: CsvTemplate) => (t.amountMode === "split" ? [t.dateCol, t.labelCol, t.debitCol, t.creditCol] : [t.dateCol, t.labelCol, t.amountCol]).filter(Boolean)
  const candidates = templates.filter((t) => cols(t).length >= 3 && cols(t).every((c) => names.has(norm(c))))
  if (!candidates.length) return null
  const sig = headerSignature(headers)
  return [...candidates].sort((a, b) =>
    Number(b.signature === sig) - Number(a.signature === sig) || Number(bankId != null && b.bankId === bankId) - Number(bankId != null && a.bankId === bankId) || cols(b).length - cols(a).length)[0]
}

export interface ImportIssue { line: number; reason: string }

/**
 * Applique un modèle aux lignes du fichier (préambule inclus) : renvoie les opérations lues et les lignes ignorées avec la raison.
 * `line` est le numéro de ligne dans le fichier (1 = première ligne), pour que l'utilisateur retrouve l'origine d'un problème.
 */
export function applyTemplate(rows: string[][], t: CsvTemplate): { headers: string[]; rows: ParsedRow[]; issues: ImportIssue[] } {
  const headers = rows[t.skipLines] ?? []
  const idx = (c: string) => (c ? headers.findIndex((h) => norm(h) === norm(c)) : -1)
  const di = idx(t.dateCol), li = idx(t.labelCol), ai = idx(t.amountCol), dbi = idx(t.debitCol), cri = idx(t.creditCol)
  const out: ParsedRow[] = [], issues: ImportIssue[] = []
  if (di < 0 || li < 0 || (t.amountMode === "single" ? ai < 0 : dbi < 0 && cri < 0)) return { headers, rows: out, issues: [{ line: t.skipLines + 1, reason: "colonnes introuvables dans l'en-tête" }] }
  rows.slice(t.skipLines + 1).forEach((cols, k) => {
    const line = t.skipLines + k + 2
    if (cols.every((c) => !c)) return
    const date = parseDate(cols[di] ?? "", t.dateFormat)
    if (!date) { issues.push({ line, reason: `date illisible (« ${cols[di] ?? ""} »)` }); return }
    let amount: number | null
    if (t.amountMode === "single") {
      amount = parseAmount(cols[ai] ?? "", t.decimal)
      if (amount !== null && t.invertSign) amount = -amount
    } else {
      const debit = dbi >= 0 ? parseAmount(cols[dbi] ?? "", t.decimal) : null
      const credit = cri >= 0 ? parseAmount(cols[cri] ?? "", t.decimal) : null
      amount = credit !== null && credit !== 0 ? Math.abs(credit) : debit !== null ? -Math.abs(debit) : credit
    }
    if (amount === null) { issues.push({ line, reason: "montant illisible" }); return }
    const name = (cols[li] ?? "").trim()
    if (!name) { issues.push({ line, reason: "libellé vide" }); return }
    out.push({ date, name, amountCents: amount })
  })
  return { headers, rows: out, issues }
}

/** Colle de tableur (« date ⇥ libellé ⇥ montant [⇥ catégorie] », une opération par ligne) → opérations, formats devinés. */
export function parsePasted(text: string): { rows: (ParsedRow & { category: string })[]; issues: ImportIssue[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : detectSeparator(text)
  const cells = lines.map((l) => tokenizeLine(l, sep))
  const fmt = guessDateFormat(cells.map((c) => c[0] ?? ""))
  const rows: (ParsedRow & { category: string })[] = [], issues: ImportIssue[] = []
  cells.forEach((c, i) => {
    const date = parseDate(c[0] ?? "", fmt), amount = parseAmount(c[2] ?? "")
    if (!date) { issues.push({ line: i + 1, reason: `date illisible (« ${c[0] ?? ""} »)` }); return }
    if (!(c[1] ?? "").trim()) { issues.push({ line: i + 1, reason: "libellé vide" }); return }
    if (amount === null) { issues.push({ line: i + 1, reason: `montant illisible (« ${c[2] ?? ""} »)` }); return }
    rows.push({ date, name: c[1].trim(), amountCents: amount, category: (c[3] ?? "").trim() })
  })
  return { rows, issues }
}

/** Valide un modèle reçu de l'extérieur (API) : renvoie un modèle propre ou null. */
export function sanitizeTemplate(v: unknown): CsvTemplate | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  const str = (x: unknown, max = 120) => (typeof x === "string" ? x.slice(0, max) : "")
  const name = str(o.name, 60).trim()
  if (!name) return null
  const amountMode = o.amountMode === "single" ? "single" : "split"
  const t: CsvTemplate = {
    name, bankId: typeof o.bankId === "string" && o.bankId ? o.bankId.slice(0, 80) : null,
    separator: (SEPARATORS as readonly string[]).includes(o.separator as string) ? (o.separator as string) : ";",
    decimal: o.decimal === "." ? "." : ",",
    dateFormat: (DATE_FORMATS as readonly string[]).includes(o.dateFormat as string) ? (o.dateFormat as DateFormat) : "DD/MM/YYYY",
    skipLines: Number.isInteger(o.skipLines) && (o.skipLines as number) >= 0 && (o.skipLines as number) <= 50 ? (o.skipLines as number) : 0,
    amountMode, dateCol: str(o.dateCol), labelCol: str(o.labelCol), amountCol: str(o.amountCol), debitCol: str(o.debitCol), creditCol: str(o.creditCol),
    invertSign: o.invertSign === true,
  }
  const needed = amountMode === "single" ? [t.dateCol, t.labelCol, t.amountCol] : [t.dateCol, t.labelCol, t.debitCol || t.creditCol]
  return needed.every(Boolean) ? t : null
}
