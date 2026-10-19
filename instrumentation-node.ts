import { secretProblem } from "@/lib/server/secret-check"

// Runtime Node uniquement : un secret manquant ou faible en production arrête le processus (code 1) avec un message clair,
// au lieu de laisser tourner un serveur qui répond 500 partout.
export function guardProductionConfig() {
  const problem = secretProblem()
  if (!problem) return
  console.error(`\n[licai] Configuration invalide : ${problem}\n`)
  process.exit(1)
}
