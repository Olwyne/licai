"use client"
import { createContext, useCallback, useContext, useEffect, useState } from "react"

export interface ChatProvider { mode: "builtin" | "custom"; endpoint: string; key: string; model: string }

const PROV_KEY = "licai-chat-provider"
interface StatusData { builtin?: boolean; source?: "account" | "server" | "none"; hint?: string; provider?: "anthropic" | "openai" | "gemini"; providerLabel?: string; chosenModel?: string; model?: string | null }
const DEFAULT_PROVIDER: ChatProvider = { mode: "builtin", endpoint: "", key: "", model: "" }

interface AssistantCtx {
  open: boolean
  openAssistant: () => void
  closeAssistant: () => void
  /** Clé API du serveur détectée (ANTHROPIC_API_KEY). */
  builtinReady: boolean
  /** D'où vient la clé : paramètres du compte, variable serveur, ou aucune. */
  keySource: "account" | "server" | "none"
  keyHint: string
  aiProvider: "anthropic" | "openai" | "gemini"
  providerLabel: string
  /** Modèle choisi dans les paramètres (vide = automatique). */
  chosenModel: string
  /** Modèle réellement utilisé (résolu à l'ouverture de l'assistant). */
  model: string
  loadModel: () => Promise<void>
  /** Relit le statut serveur (après enregistrement ou suppression de la clé). */
  refresh: () => Promise<void>
  provider: ChatProvider
  setProvider: (p: ChatProvider) => void
  /** L'assistant n'apparaît que si une clé API est fournie : celle du serveur, ou un fournisseur externe configuré. */
  available: boolean
  /** Le statut serveur a répondu (évite d'afficher/masquer la bulle pendant le chargement). */
  ready: boolean
}

export const AssistantContext = createContext<AssistantCtx>({
  open: false,
  openAssistant: () => {},
  closeAssistant: () => {},
  builtinReady: false,
  keySource: "none",
  keyHint: "",
  aiProvider: "anthropic",
  providerLabel: "Claude (Anthropic)",
  chosenModel: "",
  model: "",
  loadModel: async () => {},
  refresh: async () => {},
  provider: DEFAULT_PROVIDER,
  setProvider: () => {},
  available: false,
  ready: false,
})

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [builtinReady, setBuiltinReady] = useState(false)
  const [ready, setReady] = useState(false)
  const [keySource, setKeySource] = useState<"account" | "server" | "none">("none")
  const [keyHint, setKeyHint] = useState("")
  const [aiProvider, setAiProvider] = useState<"anthropic" | "openai" | "gemini">("anthropic")
  const [providerLabel, setProviderLabel] = useState("Claude (Anthropic)")
  const [chosenModel, setChosenModel] = useState("")
  const [model, setModel] = useState("")
  const [provider, setProviderState] = useState<ChatProvider>(DEFAULT_PROVIDER)

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/assistant/status")
      const j = (r.ok ? await r.json() : null) as { data?: StatusData } | null
      setBuiltinReady(Boolean(j?.data?.builtin)); setKeySource(j?.data?.source ?? "none"); setKeyHint(j?.data?.hint ?? "")
      setAiProvider(j?.data?.provider ?? "anthropic"); setProviderLabel(j?.data?.providerLabel ?? "Claude (Anthropic)"); setChosenModel(j?.data?.chosenModel ?? ""); setModel(j?.data?.model ?? "")
    } catch { /* statut indisponible : assistant masqué */ }
    setReady(true)
  }, [])

  const loadModel = useCallback(async () => {
    try {
      const r = await fetch("/api/assistant/status?model=1")
      const j = (r.ok ? await r.json() : null) as { data?: StatusData } | null
      if (j?.data?.model) setModel(j.data.model)
    } catch { /* modèle non résolu : l'étiquette reste générique */ }
  }, [])

  useEffect(() => {
    try { const v = localStorage.getItem(PROV_KEY); if (v) setProviderState({ ...DEFAULT_PROVIDER, ...(JSON.parse(v) as Partial<ChatProvider>) }) } catch { /* stockage indisponible */ }
    void refresh()
  }, [refresh])

  const setProvider = useCallback((p: ChatProvider) => {
    setProviderState(p)
    try { localStorage.setItem(PROV_KEY, JSON.stringify(p)) } catch { /* stockage indisponible */ }
  }, [])

  const external = provider.mode === "custom" && Boolean(provider.endpoint && provider.key)
  const available = external || (provider.mode === "builtin" && builtinReady)

  return (
    <AssistantContext.Provider value={{ open, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false), builtinReady, keySource, keyHint, aiProvider, providerLabel, chosenModel, model, loadModel, refresh, provider, setProvider, available, ready }}>
      {children}
    </AssistantContext.Provider>
  )
}

export const useAssistant = () => useContext(AssistantContext)
