"use client"
import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    householdName: "Mon foyer", city: "", email: "", password: "", seed: true,
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // If a household already exists, redirect to login
  useEffect(() => {
    fetch("/api/setup")
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.exists) router.replace("/login")
      })
      .catch(() => {})
  }, [router])

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
    <div className="auth">
      <aside className="auth-aside">
        <div className="brand">
          <div className="brand-mark">L</div>
          <div>
            <div className="brand-name">Lǐcái</div>
            <div className="brand-sub">Finances personnelles</div>
          </div>
        </div>
        <div className="aside-title">Bienvenue dans Lǐcái.</div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-h">Créer votre espace</h1>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Nom du foyer</label>
              <input type="text" value={form.householdName} onChange={set("householdName")} required />
            </div>
            <div className="field">
              <label>Ville</label>
              <input type="text" value={form.city} onChange={set("city")} placeholder="Lyon" />
            </div>
            <div className="field">
              <label>Email administrateur</label>
              <input type="email" value={form.email} onChange={set("email")} required />
            </div>
            <div className="field">
              <label>Mot de passe (8 car. min.)</label>
              <input type="password" value={form.password} onChange={set("password")} minLength={8} required />
            </div>
            <label className="check">
              <input type="checkbox" checked={form.seed} onChange={set("seed")} />
              <span>Charger les données de démonstration (foyer Lambert · Roux)</span>
            </label>
            {error && <div className="err on">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Création…" : "Créer mon espace"}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
