import { describe, it, expect } from "vitest"
import { percentSpent, isBudgetExceeded, budgetTone } from "@/lib/finance/budget"

describe("percentSpent", () => {
  it("returns 0 when nothing spent", () => expect(percentSpent(0, 40000)).toBe(0))
  it("returns 75 at 75%", () => expect(percentSpent(30000, 40000)).toBe(75))
  it("returns 110 when over budget", () => expect(percentSpent(44000, 40000)).toBe(110))
  it("returns 0 when limit is 0", () => expect(percentSpent(100, 0)).toBe(0))
})

describe("isBudgetExceeded", () => {
  it("returns false when under", () => expect(isBudgetExceeded(30000, 40000)).toBe(false))
  it("returns true when over", () => expect(isBudgetExceeded(50000, 40000)).toBe(true))
})

describe("budgetTone", () => {
  it("success when under 80%", () => expect(budgetTone(70000, 100000)).toBe("success"))
  it("warning when 80-100%", () => expect(budgetTone(85000, 100000)).toBe("warning"))
  it("danger when over 100%", () => expect(budgetTone(110000, 100000)).toBe("danger"))
})
