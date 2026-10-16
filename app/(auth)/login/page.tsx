"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { AUTH_ASIDE } from "@/components/features/auth/aside"
import { AuthShell } from "@/components/features/auth/AuthShell"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [keep, setKeep] = useState(true)

  async function startDemo() {
    setLoading(true)
    setError("")
    const res = await fetch("/api/demo", { method: "POST" })
    const { data } = await res.json()
    const result = await signIn("credentials", { email: data.email, password: data.password, keep: "1", redirect: false })
    setLoading(false)
    if (result?.error) setError("Impossible d'ouvrir la démonstration.")
    else router.push("/dashboard")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const result = await signIn("credentials", {
      email, password, keep: keep ? "1" : "0", redirect: false,
    })
    setLoading(false)
    if (result?.error) {
      setError("Email ou mot de passe incorrect.")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <AuthShell {...AUTH_ASIDE.login}>
      <h1 className="auth-h">Connexion</h1>
      <p className="auth-p">Content de vous revoir. Accédez au tableau de bord du foyer.</p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="sophie.lambert@email.fr" required />
        </div>
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <input id="pw" type="password" autoComplete="current-password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••••" required />
        </div>
        <div className="row-between">
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
            <span>Rester connecté sur cet appareil</span>
          </label>
          <a href="/forgot-password">Mot de passe oublié ?</a>
        </div>
        {error && <div className="err on">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          <i className="ti ti-login-2" /> {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <div className="sep">ou</div>
      <button className="btn btn-ghost" type="button" onClick={startDemo} disabled={loading}>
        <i className="ti ti-eye" /> Explorer la démonstration
      </button>
      <div className="alt">Pas encore de compte ? <a href="/setup">Créer un compte</a></div>
    </AuthShell>
  )
}
