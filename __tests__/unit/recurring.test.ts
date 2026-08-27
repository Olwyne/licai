import { describe, it, expect } from "vitest"
import { nextDueDate, isOverdue, frequencyToMonthlyCents } from "@/lib/finance/recurring"

describe("nextDueDate", () => {
  it("adds 1 month for monthly", () =>
    expect(nextDueDate("2026-06-15", "monthly")).toBe("2026-07-15"))
  it("adds 3 months for quarterly", () =>
    expect(nextDueDate("2026-06-08", "quarterly")).toBe("2026-09-08"))
  it("adds 12 months for annual", () =>
    expect(nextDueDate("2026-09-12", "annual")).toBe("2027-09-12"))
})

describe("isOverdue", () => {
  it("true when nextDate is before today", () =>
    expect(isOverdue("2026-06-01", "2026-06-15")).toBe(true))
  it("false when nextDate is today", () =>
    expect(isOverdue("2026-06-15", "2026-06-15")).toBe(false))
  it("false when nextDate is in the future", () =>
    expect(isOverdue("2026-06-20", "2026-06-15")).toBe(false))
})

describe("frequencyToMonthlyCents", () => {
  it("monthly stays same", () => expect(frequencyToMonthlyCents(1000, "monthly")).toBe(1000))
  it("quarterly divides by 3", () => expect(frequencyToMonthlyCents(3000, "quarterly")).toBe(1000))
  it("annual divides by 12", () => expect(frequencyToMonthlyCents(12000, "annual")).toBe(1000))
})
