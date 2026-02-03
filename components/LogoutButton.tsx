"use client"

import { useRouter } from "next/navigation"

type Props = {
  className?: string
  label?: string
  nextPath?: string
}

export default function LogoutButton({ className, label = "Logout", nextPath = "/" }: Props) {
  const router = useRouter()

  return (
    <button
      type="button"
      className={className ?? "border rounded p-2"}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        router.push(nextPath)
        router.refresh()
      }}
    >
      {label}
    </button>
  )
}
