import { describe, it, expect } from "vitest"
import { formatCents, parseCents, maskAmount, signedFormatCents } from "@/lib/money"

describe("formatCents", () => {
  it("formats positive amount", () => {
    expect(formatCents(123456)).toBe("1 234,56 €")
  })
  it("formats negative amount", () => {
    expect(formatCents(-4500)).toBe("−45,00 €")
  })
  it("formats zero", () => {
    expect(formatCents(0)).toBe("0,00 €")
  })
})

describe("parseCents", () => {
  it("parses French decimal", () => {
    expect(parseCents("1 234,56")).toBe(123456)
  })
  it("parses dot decimal", () => {
    expect(parseCents("42.90")).toBe(4290)
  })
  it("returns 0 for empty", () => {
    expect(parseCents("")).toBe(0)
  })
})

describe("maskAmount", () => {
  it("replaces digits with dots", () => {
    expect(maskAmount("1 234,56 €")).toBe("•••• €")
  })
})

describe("signedFormatCents", () => {
  it("positive has + prefix", () => {
    expect(signedFormatCents(123456)).toMatch(/^\+/)
  })
  it("negative has - prefix", () => {
    expect(signedFormatCents(-4500)).toMatch(/^-/)
  })
})
