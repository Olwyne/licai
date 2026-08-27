export interface ParsedRow {
  date: string
  name: string
  amountCents: number
}

export interface BankPreset {
  name: string
  separator: string
  decimal: string
  dateFormat: string
  debitCol?: string
  creditCol?: string
  labelCol: string
  dateCol: string
}

const PRESETS: { headers: string[]; preset: BankPreset }[] = [
  {
    headers: ["Date", "Libellé", "Débit", "Crédit"],
    preset: {
      name: "BNP Paribas",
      separator: ";",
      decimal: ",",
      dateFormat: "DD/MM/YYYY",
      dateCol: "Date",
      labelCol: "Libellé",
      debitCol: "Débit",
      creditCol: "Crédit",
    },
  },
  {
    headers: ["Date started (UTC)", "Description", "Amount"],
    preset: {
      name: "Revolut",
      separator: ",",
      decimal: ".",
      dateFormat: "YYYY-MM-DD",
      dateCol: "Date started (UTC)",
      labelCol: "Description",
    },
  },
  {
    headers: ["dateOp", "label", "amount"],
    preset: {
      name: "BoursoBank",
      separator: ";",
      decimal: ",",
      dateFormat: "DD/MM/YYYY",
      dateCol: "dateOp",
      labelCol: "label",
    },
  },
]

function parseDate(raw: string, fmt: string): string {
  const r = raw.trim()
  if (fmt === "DD/MM/YYYY") {
    const [d, m, y] = r.split("/")
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }
  return r.slice(0, 10)
}

function parseAmount(raw: string, decimal: string): number {
  if (!raw?.trim()) return 0
  const cleaned = raw.replace(/\s/g, "").replace(decimal, ".")
  return Math.round(parseFloat(cleaned) * 100)
}

export function parseCSV(
  raw: string,
  separator: string,
  decimal: string,
  dateFormat: string
): ParsedRow[] {
  const lines = raw.trim().split(/\r?\n/)
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ""))
  const preset = detectBank(headers)
  const cfg = preset ?? {
    separator,
    decimal,
    dateFormat,
    dateCol: headers[0],
    labelCol: headers[1],
  }

  const di = headers.indexOf(cfg.dateCol)
  const li = headers.indexOf(cfg.labelCol)
  const dbi = preset?.debitCol ? headers.indexOf(preset.debitCol) : -1
  const cri = preset?.creditCol ? headers.indexOf(preset.creditCol) : -1
  const ai =
    dbi === -1 ? headers.findIndex((h) => h.toLowerCase().includes("amount")) : -1

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(separator).map((c) => c.trim().replace(/^"|"$/g, ""))
      const date = parseDate(cols[di] ?? "", cfg.dateFormat ?? dateFormat)
      const name = cols[li] ?? ""
      let amountCents = 0
      if (dbi !== -1 && cri !== -1) {
        const debit = parseAmount(cols[dbi], cfg.decimal ?? decimal)
        const credit = parseAmount(cols[cri], cfg.decimal ?? decimal)
        amountCents = credit > 0 ? credit : -debit
      } else if (ai !== -1) {
        amountCents = parseAmount(cols[ai], cfg.decimal ?? decimal)
      }
      return { date, name, amountCents }
    })
}

export function detectBank(headers: string[]): BankPreset | null {
  const h = headers.map((x) => x.trim())
  for (const { headers: ph, preset } of PRESETS) {
    if (ph.every((req) => h.includes(req))) return preset
  }
  return null
}

export function mapColumns(
  row: Record<string, string>,
  mapping: { dateCol: string; labelCol: string; amountCol?: string; debitCol?: string; creditCol?: string },
  decimal = ".",
  dateFormat = "YYYY-MM-DD"
): ParsedRow {
  const date = parseDate(row[mapping.dateCol] ?? "", dateFormat)
  const name = row[mapping.labelCol] ?? ""
  let amountCents = 0
  if (mapping.debitCol && mapping.creditCol) {
    const debit = parseAmount(row[mapping.debitCol] ?? "", decimal)
    const credit = parseAmount(row[mapping.creditCol] ?? "", decimal)
    amountCents = credit > 0 ? credit : -debit
  } else if (mapping.amountCol) {
    amountCents = parseAmount(row[mapping.amountCol] ?? "", decimal)
  }
  return { date, name, amountCents }
}
