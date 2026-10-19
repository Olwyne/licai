// Vérification du secret de l'application, sans dépendance Node (utilisable depuis instrumentation.ts).
export const WEAK_SECRETS = ["", "change-me", "changeme", "secret"]

/** Erreur de configuration à corriger avant de démarrer en production, `null` si tout va bien. */
export function secretProblem(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NODE_ENV !== "production") return null
  const s = (env.NEXTAUTH_SECRET ?? env.AUTH_SECRET ?? "").trim()
  if (WEAK_SECRETS.includes(s)) return "NEXTAUTH_SECRET est absent ou vaut la valeur d'exemple : générez-en un avec « openssl rand -base64 32 »."
  if (s.length < 32) return "NEXTAUTH_SECRET est trop court (32 caractères minimum)."
  return null
}
