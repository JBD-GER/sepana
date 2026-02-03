"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

function parseHashParams(hash: string) {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)
  return {
    type: params.get("type"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  }
}

export default function InviteHashRedirect() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!window.location.hash) return
    if (pathname === "/einladung") return

    const { type, accessToken } = parseHashParams(window.location.hash)
    if (!accessToken || !type) return

    if (type === "invite") {
      router.replace(`/einladung?mode=invite${window.location.hash}`)
      return
    }
    if (type === "recovery") {
      router.replace(`/einladung?mode=reset${window.location.hash}`)
      return
    }
    if (type === "signup") {
      router.replace(`/login?confirmed=1${window.location.hash}`)
    }
  }, [pathname, router])

  return null
}
