"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", {
      email, password, redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError("Email ou mot de passe incorrect.")
    } else {
      router.push("/dashboard")
    }
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
        <div className="aside-title">Vos finances, à leur juste place.</div>
        <div className="aside-text">
          Comptes multi-banques, budgets, crédits, patrimoine, placements et impôts du foyer — dans une seule vue.
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <h1 className="auth-h">Connexion</h1>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Adresse e-mail</label>
              <input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="sophie.lambert@email.fr" required />
            </div>
            <div className="field">
              <label htmlFor="pw">Mot de passe</label>
              <input id="pw" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••" required />
            </div>
            {error && <div className="err on">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
          <div className="alt">
            Pas encore de compte ? <a href="/setup">Créer un compte</a>
          </div>
        </div>
      </main>
    </div>
  )
}
