import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

// Chiffrement des secrets stockés en base (clé API IA) : AES-256-GCM, clé dérivée de NEXTAUTH_SECRET.
const key = () => createHash("sha256").update(process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "licai-dev-secret").digest()

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".")
}

/** `null` si la valeur est vide, corrompue ou chiffrée avec un autre secret. */
export function decryptSecret(stored: string): string | null {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p ?? "", "base64"))
  if (!iv?.length || !tag?.length || !enc?.length) return null
  try {
    const d = createDecipheriv("aes-256-gcm", key(), iv)
    d.setAuthTag(tag)
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8")
  } catch { return null }
}
