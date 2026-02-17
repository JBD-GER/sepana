"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { createBrowserSupabaseClient } from "@/lib/supabase/browser"

type Message = {
  id: string
  case_id: string
  author_id: string
  visibility: string
  body: string
  created_at: string
}

function dt(d: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(d))
}

export default function CaseChat({
  caseId,
  currentUserId,
  initialMessages,
}: {
  caseId: string
  currentUserId: string
  initialMessages: Message[]
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? [])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)
  const didInitScrollRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setMessages(initialMessages ?? [])
  }, [initialMessages])

  async function refresh() {
    if (!caseId) return
    const res = await fetch(`/api/app/chat?caseId=${encodeURIComponent(caseId)}`)
    const json = await res.json().catch(() => ({}))
    const items = Array.isArray(json?.items) ? (json.items as Message[]) : []
    if (items.length) {
      setMessages(items)
    }
  }

  useEffect(() => {
    const channel = supabase
      .channel(`case_chat_${caseId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_notes", filter: `case_id=eq.${caseId}` },
        (payload: RealtimePostgresChangesPayload<Message>) => {
          const m = payload.new as Partial<Message>
          if (!m?.id || !m?.author_id || !m?.created_at || typeof m.body !== "string") return
          if (m.visibility !== "shared") return
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m as Message]))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, caseId])

  useEffect(() => {
    refresh()
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(refresh, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [caseId])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    if (didInitScrollRef.current) {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" })
      return
    }
    list.scrollTop = list.scrollHeight
    didInitScrollRef.current = true
  }, [messages.length])

  async function send() {
    const msg = text.trim()
    if (!msg) return
    setBusy(true)
    setText("")
    try {
      const res = await fetch("/api/app/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, message: msg }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json?.error || "Senden fehlgeschlagen")
      }
      refresh()
    } catch (e) {
      setText(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-900">Chat</div>
        <div className="text-xs text-slate-500">Realtime</div>
      </div>

      <div ref={listRef} className="mt-4 max-h-[420px] space-y-2 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {messages.length === 0 ? (
          <div className="text-sm text-slate-500">Noch keine Nachrichten.</div>
        ) : (
          messages.map((m) => {
            const mine = m.author_id === currentUserId
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? "bg-slate-900 text-white" : "bg-white text-slate-900"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.body}</div>
                  <div className={`mt-1 text-[11px] ${mine ? "text-slate-200" : "text-slate-500"}`}>
                    {dt(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nachricht schreiben…"
          className="min-h-[56px] w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
        <button
          onClick={send}
          disabled={busy}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-60"
        >
          Senden
        </button>
      </div>
    </div>
  )
}
