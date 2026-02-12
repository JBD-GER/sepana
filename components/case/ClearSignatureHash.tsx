"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function ClearSignatureHash() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.location.hash !== "#unterschriften") return
    const focus = searchParams?.get("focus") || ""
    if (focus === "signatures") return
    const url = new URL(window.location.href)
    url.hash = ""
    window.history.replaceState({}, "", url.toString())
    window.scrollTo({ top: 0, left: 0, behavior: "auto" })
  }, [searchParams])

  return null
}
