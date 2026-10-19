"use client"

import { useEffect, useRef, useState } from "react"
import { useLocalStorage } from "@/lib/use-local-storage"
import { useAssistant } from "@/contexts/AssistantContext"
import { ConnModal } from "./ConnModal"

type ChatMessage = { role: "user" | "assistant"; content: string }

const HIST_KEY = "licai-chat"
const SUGGESTIONS = [
  "Comment réduire mes impôts cette année ?",
  "Mon portefeuille est-il bien diversifié ?",
  "Où placer 5 000 € disponibles ?",
  "Quelles dépenses réduire en priorité ?",
  "Résume ma situation financière",
]


const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
/** Mini rendu Markdown (gras, italique, code, listes) — le texte est échappé avant. */
function md(t: string): string {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/`(.+?)`/g, "<code>$1</code>")
    .split(/\n/).map((l) => (/^#{1,3}\s+/.test(l) ? `<p><b>${l.replace(/^#{1,3}\s+/, "")}</b></p>` : /^\s*[-•]\s+/.test(l) ? `<li>${l.replace(/^\s*[-•]\s+/, "")}</li>` : l ? `<p>${l}</p>` : ""))
    .join("").replace(/(<li>.*?<\/li>)+/g, (m) => `<ul>${m}</ul>`)
}

export function AssistantChat() {
  const { open, openAssistant, closeAssistant, available, ready, provider, setProvider, providerLabel: aiLabel, model, loadModel } = useAssistant()
  const [stored, setStored] = useLocalStorage<ChatMessage[]>(HIST_KEY, [])
  const [live, setHistory] = useState<ChatMessage[] | null>(null) // réponse en cours de réception (non enregistrée)
  const history = live ?? stored
  const [connOpen, setConnOpen] = useState(false)
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [history, busy, open])
  useEffect(() => { if (open) { setTimeout(() => inputRef.current?.focus(), 120); void loadModel() } }, [open, loadModel])

  const commit = (h: ChatMessage[]) => { setHistory(null); setStored(h.slice(-40)) }

  async function askBuiltin(msgs: ChatMessage[], onChunk: (t: string) => void) {
    const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: msgs }) })
    if (!res.ok || !res.body) { const body = (await res.json().catch(() => null)) as { error?: string } | null; throw new Error(body?.error ?? (res.status === 503 ? "aucune clé API configurée" : `HTTP ${res.status}`)) }
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = ""
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split("\n\n"); buf = parts.pop() ?? ""
      for (const line of parts) { if (line.startsWith("data: ") && line.slice(6) !== "[DONE]") { try { onChunk(JSON.parse(line.slice(6)) as string) } catch { /* fragment ignoré */ } } }
    }
  }

  async function askCustom(msgs: ChatMessage[]): Promise<string> {
    const ctxRes = await fetch("/api/assistant/context")
    if (!ctxRes.ok) throw new Error("contexte indisponible")
    const { data } = (await ctxRes.json()) as { data: { system: string; snapshot: unknown } }
    const res = await fetch(provider.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(provider.key ? { Authorization: "Bearer " + provider.key } : {}) },
      body: JSON.stringify({ model: provider.model || undefined, system: `${data.system}\n\nDonnées du foyer (JSON) :\n${JSON.stringify(data.snapshot)}`, messages: msgs.slice(-7) }),
    })
    if (!res.ok) throw new Error("HTTP " + res.status)
    const j = (await res.json()) as { text?: string; content?: { text?: string }[]; choices?: { message?: { content?: string } }[] }
    return j.text ?? j.content?.[0]?.text ?? j.choices?.[0]?.message?.content ?? JSON.stringify(j).slice(0, 500)
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || busy) return
    setInput("")
    const base = [...history, { role: "user" as const, content: q }]
    commit(base)
    setBusy(true)
    try {
      if (provider.mode === "custom") {
        if (!provider.endpoint) throw new Error("fournisseur externe non configuré")
        commit([...base, { role: "assistant", content: await askCustom(base) }])
      } else {
        let acc = ""
        commit([...base, { role: "assistant", content: "" }])
        await askBuiltin(base.slice(-8), (t) => { acc += t; setHistory([...base, { role: "assistant", content: acc }]) })
        commit([...base, { role: "assistant", content: acc || "Aucune réponse reçue." }])
      }
    } catch (e) {
      commit([...base, { role: "assistant", content: `Impossible d'obtenir une réponse : ${(e as Error).message}.\n\n- Vérifiez la configuration du fournisseur avec le bouton **Connexion**\n- Ou repassez sur le modèle intégré` }])
    } finally {
      setBusy(false)
    }
  }

  const providerLabel = provider.mode === "custom" ? (provider.endpoint ? "Fournisseur externe" : "Fournisseur non configuré") : `${aiLabel.split(" ")[0]}${model ? ` · ${model}` : ""}`

  // Sans clé API (serveur ou fournisseur externe), l'assistant n'existe pas dans l'interface.
  if (!ready || !available) return null

  return (
    <>
      {!open && (
        <button className="chat-fab" onClick={openAssistant} aria-label="Ouvrir l'assistant IA"><i aria-hidden="true" className="ti ti-message-circle-2" /></button>
      )}
      <aside className={`chat-panel${open ? " open" : ""}`}>
        <div className="chat-head">
          <div className="chat-mark"><i aria-hidden="true" className="ti ti-sparkles" /></div>
          <div>
            <div className="chat-title">Assistant Lǐcái</div>
            <div className="chat-sub">{providerLabel} · lecture de vos données</div>
          </div>
          <button className="icon-btn" title="Connecter un fournisseur" onClick={() => setConnOpen(true)}><i aria-hidden="true" className="ti ti-plug-connected" /></button>
          <button className="icon-btn" title="Effacer la conversation" onClick={() => commit([])}><i aria-hidden="true" className="ti ti-eraser" /></button>
          <button className="icon-btn" title="Fermer" onClick={closeAssistant}><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="chat-log" ref={logRef}>
          {history.length === 0 ? (
            <div className="ch-empty">
              <i aria-hidden="true" className="ti ti-sparkles" />
              <div className="ch-empty-t">L&apos;assistant lit vos comptes, budgets, crédits, placements et impôts</div>
              <div className="ch-empty-s">Posez une question ou choisissez une suggestion. Aucune donnée n&apos;est envoyée avant votre premier message.</div>
              <div className="ch-empty-s" style={{ marginTop: 10 }}>Ses réponses sont informatives : ni conseil en investissement, ni conseil fiscal. Risque de perte en capital.</div>
            </div>
          ) : history.map((m, i) => m.role === "user"
            ? <div className="ch-msg me" key={i}><div className="ch-bubble" dangerouslySetInnerHTML={{ __html: md(m.content) }} /></div>
            : <div className="ch-msg ai" key={i}><div className="ch-av">L</div><div className="ch-bubble" dangerouslySetInnerHTML={{ __html: md(m.content || "…") }} /></div>)}
          {busy && history[history.length - 1]?.role !== "assistant" && (
            <div className="ch-msg ai"><div className="ch-av">L</div><div className="ch-bubble typing"><span /><span /><span /></div></div>
          )}
        </div>
        <div className="chips chat-suggest">
          {SUGGESTIONS.map((s) => <button key={s} className="chip" disabled={busy} onClick={() => void send(s)}>{s}</button>)}
        </div>
        <div className="disclaimer sm chat-disc"><i aria-hidden="true" className="ti ti-info-circle" /> <span>Analyses informatives — ni conseil en investissement, ni conseil fiscal. Risque de perte en capital ; décisions et conséquences à votre seule charge.</span></div>
        <div className="chat-input-row">
          <textarea ref={inputRef} rows={1} placeholder="Poser une question sur vos finances…" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input) } }} />
          <button className="btn btn-primary" onClick={() => void send(input)} disabled={busy || !input.trim()} aria-label="Envoyer"><i aria-hidden="true" className="ti ti-send" /></button>
        </div>
      </aside>
      {connOpen && <ConnModal provider={provider} onClose={() => setConnOpen(false)} onSave={(p) => { setProvider(p); setConnOpen(false) }} />}
    </>
  )
}
