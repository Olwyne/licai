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
