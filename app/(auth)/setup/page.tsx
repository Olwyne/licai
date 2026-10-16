"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { passwordIssue, passwordStrength } from "@/lib/password"
import { CURRENCIES, FIAT_CODES } from "@/lib/finance/fx"
import { AuthShell } from "@/components/features/auth/AuthShell"

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    firstName: "", lastName: "", householdName: "", city: "", currency: "EUR", email: "", password: "", seed: false,
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [cgu, setCgu] = useState(false)
  const [risk, setRisk] = useState(false)
  const strength = passwordStrength(form.password)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target instanceof HTMLInputElement && e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const issue = passwordIssue(form.password)
    if (issue) { setError(issue); return }
    if (!cgu || !risk) { setError("Acceptez les deux cases pour continuer."); return }
    setLoading(true)
    setError("")
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) { setLoading(false); setError(json.error); return }
    await signIn("credentials", { email: form.email, password: form.password, redirect: false })
    router.push("/dashboard")
  }

  return (
    <AuthShell
      title="Commencez par un foyer, pas par un compte."
      text="Ajoutez les personnes, rattachez les comptes de chaque banque, importez un relevé : Lǐcái calcule le reste."
      items={[
        { icon: "ti-home-heart", label: "Un foyer, plusieurs personnes et quotes-parts" },
        { icon: "ti-file-import", label: "Import CSV avec formats de colonnes mémorisés" },
        { icon: "ti-receipt-tax", label: "Impôt du foyer estimé et pistes d'optimisation" },
        { icon: "ti-sparkles", label: "Assistant qui lit vos données pour répondre" },
      ]}
    >
      <h1 className="auth-h">Créer un compte</h1>
      <p className="auth-p">Deux minutes, aucune carte bancaire.</p>
      <form onSubmit={handleSubmit}>
        <div className="field-row">
          <div className="field">
            <label htmlFor="fn">Prénom</label>
            <input id="fn" type="text" autoComplete="given-name" value={form.firstName} onChange={set("firstName")} placeholder="Sophie" required />
          </div>
          <div className="field">
            <label htmlFor="ln">Nom</label>
            <input id="ln" type="text" autoComplete="family-name" value={form.lastName} onChange={set("lastName")} placeholder="Lambert" required />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="house">Nom du foyer</label>
            <input id="house" type="text" value={form.householdName} onChange={set("householdName")} placeholder="Foyer Lambert · Roux" required />
          </div>
          <div className="field">
            <label htmlFor="cur">Devise de référence</label>
            <select id="cur" value={form.currency} onChange={set("currency")}>
              {FIAT_CODES.map((k) => <option key={k} value={k}>{k} — {CURRENCIES[k].name} ({CURRENCIES[k].sym})</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="sophie.lambert@email.fr" required />
        </div>
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <input id="pw" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} placeholder="12 caractères minimum" required />
          <div className="strength">{[0, 1, 2, 3].map((i) => <span key={i} className={i < strength ? "on" : ""} />)}</div>
          <div className="hint">Au moins 12 caractères, dont une majuscule et un chiffre.</div>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.seed} onChange={set("seed")} />
          <span>Charger les données de démonstration (foyer Lambert · Roux)</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={cgu} onChange={(e) => setCgu(e.target.checked)} />
          <span>J&apos;accepte les <a href="/legal/conditions.html">conditions d&apos;utilisation</a> et j&apos;ai pris connaissance des <a href="/legal/mentions-legales.html">mentions légales</a>.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={risk} onChange={(e) => setRisk(e.target.checked)} />
          <span>Je comprends que Lǐcái ne fournit aucun conseil en investissement ni conseil fiscal, et que mes décisions financières relèvent de ma seule responsabilité.</span>
        </label>
        {error && <div className="err on">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          <i className="ti ti-user-plus" /> {loading ? "Création…" : "Créer mon foyer"}
        </button>
      </form>
      <div className="alt">Déjà inscrit(e) ? <a href="/login">Se connecter</a></div>
    </AuthShell>
  )
}
