"use client"
import { useState } from "react"

export interface ChatProvider { mode: "builtin" | "custom"; endpoint: string; key: string; model: string }

export function ConnModal({ provider, onClose, onSave }: { provider: ChatProvider; onClose: () => void; onSave: (p: ChatProvider) => void }) {
  const [p, setP] = useState<ChatProvider>(provider)
  return (
    <div className="modal-overlay open" style={{ zIndex: 80 }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Connecter un modèle</h3>
          <button className="icon-btn" type="button" style={{ width: 30, height: 30 }} onClick={onClose} aria-label="Fermer"><i aria-hidden="true" className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Fournisseur</label>
            <select value={p.mode} onChange={(e) => setP({ ...p, mode: e.target.value as ChatProvider["mode"] })}>
              <option value="builtin">Modèle intégré à l&apos;application</option>
              <option value="custom">Point d&apos;accès externe (votre backend)</option>
            </select>
            <div className="field-hint">
              En mode externe, l&apos;app envoie <code>POST {"{endpoint}"}</code> avec <code>{"{ system, messages, model }"}</code> et lit la réponse dans <code>text</code>, <code>content[0].text</code> ou <code>choices[0].message.content</code>. La clé n&apos;est jamais transmise ailleurs qu&apos;à cette adresse.
            </div>
          </div>
          {p.mode === "custom" && (
            <>
              <div className="field"><label>Endpoint</label><input type="text" placeholder="https://api.exemple.com/v1/chat" value={p.endpoint} onChange={(e) => setP({ ...p, endpoint: e.target.value })} /></div>
              <div className="field-row">
                <div className="field"><label>Clé d&apos;API</label><input type="text" placeholder="sk-…" value={p.key} onChange={(e) => setP({ ...p, key: e.target.value })} /></div>
                <div className="field"><label>Modèle</label><input type="text" placeholder="claude-sonnet-4-5" value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })} /></div>
              </div>
            </>
          )}
          <div className="field-hint">Les données transmises sont celles visibles dans l&apos;app : comptes, budgets, crédits, biens, placements et situation fiscale. Rien n&apos;est envoyé avant votre premier message.</div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => onSave({ ...p, endpoint: p.endpoint.trim(), key: p.key.trim(), model: p.model.trim() })}><i aria-hidden="true" className="ti ti-check" /> Enregistrer</button>
        </div>
      </div>
    </div>
  )
}
