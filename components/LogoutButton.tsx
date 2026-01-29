"use client"

import { useRouter } from "next/navigation"

export default function LogoutButton() {
  const router = useRouter()

  return (
    <button
      className="border rounded p-2"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        router.push("/")
        router.refresh()
      }}
    >
      Logout
    </button>
  )
}
