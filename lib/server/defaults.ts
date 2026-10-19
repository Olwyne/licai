import { db } from "@/lib/db"
import { categories } from "@/db/schema"
import { randomUUID } from "crypto"

export interface DefaultCategory { key: string; label: string; icon: string; colorHex: string }

/** Catégories du foyer de démonstration. Un vrai foyer démarre vide : il crée les siennes (avec des préchoix, cf. CategoryModal). */
export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { key: "food",      label: "Alimentation", icon: "ti-basket",        colorHex: "#1D9E75" },
  { key: "home",      label: "Logement",      icon: "ti-home",          colorHex: "#888780" },
  { key: "transport", label: "Transport",     icon: "ti-train",         colorHex: "#378ADD" },
  { key: "leisure",   label: "Loisirs",       icon: "ti-device-tv",     colorHex: "#7C6BD6" },
  { key: "shopping",  label: "Shopping",      icon: "ti-shirt",         colorHex: "#D4537E" },
  { key: "health",    label: "Santé",         icon: "ti-pill",          colorHex: "#D85A30" },
  { key: "income",    label: "Revenu",        icon: "ti-building-bank", colorHex: "#1D9E75" },
  { key: "credits",   label: "Crédits",       icon: "ti-percentage",    colorHex: "#888780" },
]

/** Crée les catégories d'un foyer et renvoie leurs identifiants par clé. */
export function createCategories(householdId: string, defs: DefaultCategory[]): Record<string, string> {
  const ids: Record<string, string> = {}
  for (const c of defs) {
    ids[c.key] = randomUUID()
    db.insert(categories).values({ id: ids[c.key], householdId, label: c.label, icon: c.icon, colorHex: c.colorHex, isSystem: true }).run()
  }
  return ids
}
