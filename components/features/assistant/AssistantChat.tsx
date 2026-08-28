"use client"

import { useState, useRef, useEffect } from "react"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Bonjour ! Je suis votre assistant financier. Posez-moi vos questions sur vos comptes, budgets, objectifs ou transactions.",
}

export function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const msgsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (msgsRef.current) {
      msgsRef.current.scrollTop = msgsRef.current.scrollHeight
    }
  }, [messages])

  async function send() {
    if (!input.trim() || streaming) return
    const userMsg: ChatMessage = { role: "user", content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput("")
    setStreaming(true)
    setMessages((prev) => [...prev, { role: "assistant", content: "" }])

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      })
      if (!res.ok) throw new Error("Erreur serveur")
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6)
          if (data === "[DONE]") break
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.role === "assistant") last.content += data
            return updated
          })
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === "assistant") last.content = "Désolé, une erreur est survenue."
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Ouvrir l'assistant IA">
        <i className="ti ti-message-circle-2" />
      </button>
    )
  }

  return (
    <>
      <button className="chat-fab" onClick={() => setOpen(false)} aria-label="Fermer l'assistant IA">
        <i className="ti ti-x" />
      </button>
      <div className="chat-panel">
        <div className="chat-head">
          <span>Assistant IA</span>
          <button
            onClick={() => setOpen(false)}
            className="chat-close-btn"
            aria-label="Fermer"
          >
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="chat-msgs" ref={msgsRef}>
          {messages.map((msg, i) => (
            <div key={i} className={`chat-msg ${msg.role}`}>
              {msg.content}
              {streaming && i === messages.length - 1 && msg.role === "assistant" && (
                <span className="chat-cursor" />
              )}
            </div>
          ))}
        </div>
        <div className="chat-input-row">
          <textarea
            className="chat-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question…"
            disabled={streaming}
          />
          <button className="chat-send" onClick={() => void send()} disabled={streaming || !input.trim()} aria-label="Envoyer">
            <i className="ti ti-send" />
          </button>
        </div>
      </div>
    </>
  )
}
