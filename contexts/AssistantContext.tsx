"use client"
import { createContext, useContext, useState } from "react"

interface AssistantCtx {
  open: boolean
  openAssistant: () => void
  closeAssistant: () => void
}

export const AssistantContext = createContext<AssistantCtx>({
  open: false,
  openAssistant: () => {},
  closeAssistant: () => {},
})

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <AssistantContext.Provider value={{ open, openAssistant: () => setOpen(true), closeAssistant: () => setOpen(false) }}>
      {children}
    </AssistantContext.Provider>
  )
}

export const useAssistant = () => useContext(AssistantContext)
