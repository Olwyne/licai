import { describe, it, expect } from "vitest"
import { parseCSV, detectBank, mapColumns } from "@/lib/finance/csv"

const BNP_SAMPLE = `Date;Libellé;Débit;Crédit
02/06/2026;CARREFOUR MARKET LYON;41,20;
03/06/2026;VIR SALAIRE ROUX T.;;2 050,00`

const REVOLUT_SAMPLE = `Date started (UTC),Description,Amount
2026-06-02,Netflix,-13.49
2026-06-03,Salary,2050.00`

const UNKNOWN_SAMPLE = `txDate,txLabel,txAmount
2026-06-02,Test payment,99.50`

describe("parseCSV", () => {
  it("parses BNP semicolon CSV", () => {
    const rows = parseCSV(BNP_SAMPLE, ";", ",", "DD/MM/YYYY")
    expect(rows).toHaveLength(2)
    expect(rows[0].date).toBe("2026-06-02")
    expect(rows[0].name).toBe("CARREFOUR MARKET LYON")
    expect(rows[0].amountCents).toBe(-4120)
    expect(rows[1].amountCents).toBe(205000)
  })

  it("BNP credit row produces positive amount", () => {
    const rows = parseCSV(BNP_SAMPLE, ";", ",", "DD/MM/YYYY")
    expect(rows[1].date).toBe("2026-06-03")
    expect(rows[1].name).toBe("VIR SALAIRE ROUX T.")
    expect(rows[1].amountCents).toBe(205000)
  })

  it("parses Revolut CSV", () => {
    const rows = parseCSV(REVOLUT_SAMPLE, ",", ".", "YYYY-MM-DD")
    expect(rows).toHaveLength(2)
    expect(rows[0].date).toBe("2026-06-02")
    expect(rows[0].name).toBe("Netflix")
    expect(rows[0].amountCents).toBe(-1349)
    expect(rows[1].amountCents).toBe(205000)
  })

  it("parses unknown format using provided args", () => {
    const rows = parseCSV(UNKNOWN_SAMPLE, ",", ".", "YYYY-MM-DD")
    expect(rows).toHaveLength(1)
    expect(rows[0].date).toBe("2026-06-02")
    expect(rows[0].name).toBe("Test payment")
    // amount col not found via ai heuristic here since header doesn't contain "amount" lowercase...
    // actually "txAmount".toLowerCase() includes "amount" → amountCents = 9950
    expect(rows[0].amountCents).toBe(9950)
  })

  it("handles empty amount cell (returns 0)", () => {
    const csv = `Date started (UTC),Description,Amount\n2026-06-02,Empty,`
    const rows = parseCSV(csv, ",", ".", "YYYY-MM-DD")
    expect(rows[0].amountCents).toBe(0)
  })
})

describe("detectBank", () => {
  it("detects BNP from headers", () => {
    const preset = detectBank(["Date", "Libellé", "Débit", "Crédit"])
    expect(preset?.name).toBe("BNP Paribas")
    expect(preset?.separator).toBe(";")
  })
  it("detects Revolut from headers", () => {
    const preset = detectBank(["Date started (UTC)", "Description", "Amount"])
    expect(preset?.name).toBe("Revolut")
  })
  it("detects BoursoBank from headers", () => {
    const preset = detectBank(["dateOp", "label", "amount"])
    expect(preset?.name).toBe("BoursoBank")
  })
  it("returns null for unknown headers", () => {
    expect(detectBank(["date", "amount", "description"])).toBeNull()
  })
})

describe("mapColumns", () => {
  it("maps row with amount column", () => {
    const row = { date: "2026-06-02", label: "Test", amount: "12.50" }
    const result = mapColumns(
      row,
      { dateCol: "date", labelCol: "label", amountCol: "amount" },
      ".",
      "YYYY-MM-DD"
    )
    expect(result.name).toBe("Test")
    expect(result.amountCents).toBe(1250)
    expect(result.date).toBe("2026-06-02")
  })

  it("maps row with debit/credit columns — credit wins when positive", () => {
    const row = { date: "01/06/2026", label: "Salary", debit: "", credit: "2 050,00" }
    const result = mapColumns(
      row,
      { dateCol: "date", labelCol: "label", debitCol: "debit", creditCol: "credit" },
      ",",
      "DD/MM/YYYY"
    )
    expect(result.amountCents).toBe(205000)
  })

  it("maps row with debit/credit columns — debit negated when credit is 0", () => {
    const row = { date: "01/06/2026", label: "Rent", debit: "800,00", credit: "" }
    const result = mapColumns(
      row,
      { dateCol: "date", labelCol: "label", debitCol: "debit", creditCol: "credit" },
      ",",
      "DD/MM/YYYY"
    )
    expect(result.amountCents).toBe(-80000)
  })

  it("returns 0 amountCents when no amount or debit/credit mapping provided", () => {
    const row = { date: "2026-06-02", label: "Ghost" }
    const result = mapColumns(row, { dateCol: "date", labelCol: "label" }, ".", "YYYY-MM-DD")
    expect(result.amountCents).toBe(0)
  })
})
