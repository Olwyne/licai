"use client"
import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { useFetch } from "@/lib/use-fetch"
import { useLocalStorage } from "@/lib/use-local-storage"

export interface ChatProvider { mode: "builtin" | "custom"; endpoint: string; key: string; model: string }

const PROV_KEY = "licai-chat-provider"
interface StatusData { builtin?: boolean; unreadable?: boolean; source?: "account" | "server" | "none"; hint?: string; provider?: "anthropic" | "openai" | "gemini"; providerLabel?: string; chosenModel?: string; model?: string | null }
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
  /** Clé enregistrée mais illisible : à ressaisir. */
  keyUnreadable: boolean
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
  keyUnreadable: false,
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
  const status = useFetch<StatusData>("/api/assistant/status")
  const [resolvedModel, setResolvedModel] = useState("")
  const [stored, setStored] = useLocalStorage<Partial<ChatProvider>>(PROV_KEY, {})
  const provider = useMemo<ChatProvider>(() => ({ ...DEFAULT_PROVIDER, ...stored }), [stored])

  const d = status.data
  const ready = status.data !== null || status.error !== ""
  const builtinReady = Boolean(d?.builtin)
  const keySource = d?.source ?? "none"
  const keyHint = d?.hint ?? ""
  const keyUnreadable = Boolean(d?.unreadable)
  const aiProvider = d?.provider ?? "anthropic"
  const providerLabel = d?.providerLabel ?? "Claude (Anthropic)"
  const chosenModel = d?.chosenModel ?? ""
  const model = resolvedModel || (d?.model ?? "")

  const refresh = useCallback(async () => { status.reload() }, [status.reload]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadModel = useCallback(async () => {
    try {
      const r = await fetch("/api/assistant/status?model=1")
      const j = (r.ok ? await r.json() : null) as { data?: StatusData } | null
      if (j?.data?.model) setResolvedModel(j.data.model)
    } catch { /* modèle non résolu : l'étiquette reste générique */ }
  }, [])

  const setProvider = useCallback((p: ChatProvider) => setStored(p), [setStored])

  const external = provider.mode === "custom" && Boolean(provider.endpoint && provider.key)
  const available = external || (provider.mode === "builtin" && builtinReady)

  return (
    <AssistantContext.Provider value={{ open, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false), builtinReady, keySource, keyHint, keyUnreadable, aiProvider, providerLabel, chosenModel, model, loadModel, refresh, provider, setProvider, available, ready }}>
      {children}
    </AssistantContext.Provider>
  )
}

export const useAssistant = () => useContext(AssistantContext)
