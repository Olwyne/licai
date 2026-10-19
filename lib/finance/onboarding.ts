// Premiers pas d'un foyer : ce qu'il faut renseigner pour que le tableau de bord devienne utile.

export interface OnboardingCounts {
  accounts: number
  transactions: number
  budgets: number
  members: number
  incomeSet: boolean
  recurring: number
  aiKey: boolean
}

export interface OnboardingStep { id: string; label: string; desc: string; href: string; done: boolean; optional: boolean }

export function onboardingSteps(c: OnboardingCounts): OnboardingStep[] {
  return [
    { id: "account", label: "Ajouter un compte bancaire", desc: "Courant, livret, carte… avec son solde et sa devise.", href: "/comptes", done: c.accounts > 0, optional: false },
    { id: "transactions", label: "Importer ou saisir vos opérations", desc: "Import du CSV de votre banque (le format est mémorisé) ou saisie à la main.", href: "/transactions?import=1", done: c.transactions > 0, optional: false },
    { id: "income", label: "Renseigner vos revenus", desc: "Le taux d'endettement, la capacité d'emprunt et les impôts en dépendent.", href: "/comptes", done: c.incomeSet, optional: false },
    { id: "budget", label: "Fixer vos premiers budgets", desc: "Des plafonds par catégorie, suggérés d'après vos dépenses réelles.", href: "/budget", done: c.budgets > 0, optional: false },
    { id: "members", label: "Ajouter les autres personnes du foyer", desc: "Conjoint, enfants : comptes partagés, quotes-parts, argent de poche.", href: "/comptes", done: c.members > 1, optional: true },
    { id: "recurring", label: "Déclarer vos charges récurrentes", desc: "Abonnements, assurances, loyers : base des prévisions et des alertes.", href: "/recurrent", done: c.recurring > 0, optional: true },
    { id: "ai", label: "Activer l'assistant IA", desc: "Ajoutez une clé API (Claude, ChatGPT ou Gemini) pour obtenir des conseils chiffrés.", href: "/parametres", done: c.aiKey, optional: true },
  ]
}

export interface OnboardingProgress { steps: OnboardingStep[]; required: number; requiredDone: number; complete: boolean; next: OnboardingStep | null }

/** Avancement : les étapes indispensables comptent pour la progression ; les facultatives sont proposées ensuite. */
export function onboardingProgress(c: OnboardingCounts): OnboardingProgress {
  const steps = onboardingSteps(c)
  const required = steps.filter((s) => !s.optional)
  const requiredDone = required.filter((s) => s.done).length
  return { steps, required: required.length, requiredDone, complete: requiredDone === required.length, next: steps.find((s) => !s.done && !s.optional) ?? null }
}
