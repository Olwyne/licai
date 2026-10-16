import type { FullConfig } from "@playwright/test"

export const E2E_EMAIL = "sophie@lambert.fr"
export const E2E_PASSWORD = "Demo-Foyer-2026"

// Crée le foyer de démonstration (membres, comptes, transactions, placements…) une seule fois.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3100"
  const res = await fetch(`${baseURL}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ householdName: "Famille Lambert", city: "Lyon", firstName: "Sophie", lastName: "Lambert", email: E2E_EMAIL, password: E2E_PASSWORD, seed: true }),
  })
  if (!res.ok && res.status !== 409) throw new Error(`Initialisation e2e impossible : HTTP ${res.status} ${await res.text()}`)
}
