import { describe, it, expect } from "vitest"
import { onboardingProgress, type OnboardingCounts } from "@/lib/finance/onboarding"

const empty: OnboardingCounts = { accounts: 0, transactions: 0, budgets: 0, members: 1, incomeSet: false, recurring: 0, aiKey: false }

describe("onboardingProgress", () => {
  it("foyer vide : 0/4 et première étape = compte", () => {
    const p = onboardingProgress(empty)
    expect(p.required).toBe(4)
    expect(p.requiredDone).toBe(0)
    expect(p.complete).toBe(false)
    expect(p.next?.id).toBe("account")
  })

  it("avance étape par étape", () => {
    const p = onboardingProgress({ ...empty, accounts: 1, transactions: 12 })
    expect(p.requiredDone).toBe(2)
    expect(p.next?.id).toBe("income")
  })

  it("complet quand les 4 étapes indispensables sont faites, les facultatives restent proposées", () => {
    const p = onboardingProgress({ ...empty, accounts: 1, transactions: 1, incomeSet: true, budgets: 3 })
    expect(p.complete).toBe(true)
    expect(p.next).toBeNull()
    expect(p.steps.filter((s) => s.optional && !s.done)).toHaveLength(3)
  })

  it("« autres membres » exige plus d'une personne", () => {
    const only = onboardingProgress(empty).steps.find((s) => s.id === "members")
    const two = onboardingProgress({ ...empty, members: 2 }).steps.find((s) => s.id === "members")
    expect(only?.done).toBe(false)
    expect(two?.done).toBe(true)
  })
})
