"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

function authModeFromType(type: string | null) {
  if (type === "invite") return "invite"
  if (type === "recovery") return "reset"
  if (type === "signup") return "signup"
  return null
}

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
    if (pathname === "/einladung") return

    const query = new URLSearchParams(window.location.search)
    const queryType = query.get("type")
    const queryMode = authModeFromType(queryType)
    const hasQueryAuthPayload = Boolean(query.get("code") || (query.get("token_hash") && queryType))

    if (queryMode && hasQueryAuthPayload) {
      if (!query.get("mode")) query.set("mode", queryMode)
      router.replace(`/auth/confirm?${query.toString()}`)
      return
    }

    if (!window.location.hash) return

    const { type, accessToken } = parseHashParams(window.location.hash)
    const hashMode = authModeFromType(type)
    if (!accessToken || !hashMode) return

    if (hashMode === "invite") {
      router.replace(`/einladung?mode=invite${window.location.hash}`)
      return
    }
    if (hashMode === "reset") {
      router.replace(`/einladung?mode=reset${window.location.hash}`)
      return
    }
    if (hashMode === "signup") {
      router.replace(`/login?confirmed=1${window.location.hash}`)
    }
  }, [pathname, router])

  return null
}
