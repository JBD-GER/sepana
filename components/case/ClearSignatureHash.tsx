"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

function toRelativeUrl(url: URL) {
  const search = url.searchParams.toString()
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`
}

export default function ClearSignatureHash() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined") return
    const focus = (searchParams?.get("focus") || "").trim().toLowerCase()
    const url = new URL(window.location.href)

    if (focus === "signatures") {
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete("focus")
      cleanUrl.hash = ""
      window.requestAnimationFrame(() => {
        window.history.replaceState({}, "", toRelativeUrl(cleanUrl))
      })
      return
    }

    if (url.hash) {
      url.hash = ""
      window.history.replaceState({}, "", toRelativeUrl(url))
      if (window.scrollY > 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" })
      }
    }
  }, [searchParams])

  return null
}
