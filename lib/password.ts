export const PASSWORD_MIN = 12

/** Règle d'inscription : 12 caractères minimum, une majuscule et un chiffre. Renvoie le message d'erreur ou null. */
export function passwordIssue(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`
  if (!/[A-Z]/.test(pw)) return "Le mot de passe doit contenir une majuscule."
  if (!/\d/.test(pw)) return "Le mot de passe doit contenir un chiffre."
  return null
}

/** Nombre de critères remplis (0-4) pour l'indicateur de force. */
export function passwordStrength(pw: string): number {
  return [pw.length >= 8, pw.length >= PASSWORD_MIN, /[A-Z]/.test(pw), /\d/.test(pw)].filter(Boolean).length
}
