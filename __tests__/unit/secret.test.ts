import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret } from "@/lib/server/secret"

describe("chiffrement des secrets", () => {
  it("chiffre puis déchiffre à l'identique, sans laisser la valeur en clair", () => {
    const enc = encryptSecret("sk-ant-secret-1234567890")
    expect(enc).not.toContain("sk-ant")
    expect(decryptSecret(enc)).toBe("sk-ant-secret-1234567890")
  })
  it("deux chiffrements de la même valeur diffèrent (IV aléatoire)", () => {
    expect(encryptSecret("x".repeat(30))).not.toBe(encryptSecret("x".repeat(30)))
  })
  it("renvoie null pour une valeur vide, altérée ou illisible", () => {
    expect(decryptSecret("")).toBeNull()
    expect(decryptSecret("n'importe quoi")).toBeNull()
    const [iv, tag, data] = encryptSecret("sk-ant-secret-1234567890").split(".")
    const tampered = Buffer.from(data, "base64"); tampered[0] ^= 1
    expect(decryptSecret([iv, tag, tampered.toString("base64")].join("."))).toBeNull()
  })
})

import { secretProblem } from "@/lib/server/secret"
describe("secret de l'application", () => {
  const prod = (s?: string) => ({ NODE_ENV: "production", NEXTAUTH_SECRET: s }) as unknown as NodeJS.ProcessEnv
  it("refuse de démarrer en production sans secret, avec la valeur d'exemple ou un secret trop court", () => {
    expect(secretProblem(prod())).toMatch(/absent/)
    expect(secretProblem(prod("change-me"))).toMatch(/absent/)
    expect(secretProblem(prod("trop-court"))).toMatch(/trop court/)
  })
  it("accepte un secret de 32 caractères en production, et tout en développement", () => {
    expect(secretProblem(prod("x".repeat(32)))).toBeNull()
    expect(secretProblem({ NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv)).toBeNull()
  })
  it("une clé chiffrée avec un autre secret est illisible (null) au lieu de planter", () => {
    const before = process.env.NEXTAUTH_SECRET
    process.env.NEXTAUTH_SECRET = "a".repeat(40)
    const enc = encryptSecret("sk-ant-secret-1234567890")
    process.env.NEXTAUTH_SECRET = "b".repeat(40)
    expect(decryptSecret(enc)).toBeNull()
    process.env.NEXTAUTH_SECRET = before
  })
})
