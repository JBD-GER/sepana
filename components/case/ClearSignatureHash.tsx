"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export default function ClearSignatureHash() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined") return
    const focus = searchParams?.get("focus") || ""
    if (focus === "signatures") return
    const url = new URL(window.location.href)
    if (url.hash) {
      url.hash = ""
      window.history.replaceState({}, "", url.toString())
    }
    if (window.scrollY > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    }
  }, [searchParams])

  return null
}
