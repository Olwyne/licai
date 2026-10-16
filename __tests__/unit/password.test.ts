import { describe, expect, it } from "vitest"
import { passwordIssue, passwordStrength } from "@/lib/password"

describe("règle de mot de passe", () => {
  it("refuse trop court, sans majuscule, sans chiffre", () => {
    expect(passwordIssue("Court1")).toMatch(/12 caractères/)
    expect(passwordIssue("motdepasse-long1")).toMatch(/majuscule/)
    expect(passwordIssue("Motdepasse-long")).toMatch(/chiffre/)
  })
  it("accepte un mot de passe conforme", () => {
    expect(passwordIssue("Motdepasse-2026")).toBeNull()
  })
  it("calcule la force sur 4 critères", () => {
    expect(passwordStrength("")).toBe(0)
    expect(passwordStrength("Motdepasse-2026")).toBe(4)
  })
})
