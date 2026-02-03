"use client"

import { useRouter } from "next/navigation"

type Props = {
  className?: string
  label?: string
}

export default function LogoutButton({ className, label = "Logout" }: Props) {
  const router = useRouter()

  return (
    <button
      className={className ?? "border rounded p-2"}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" })
        router.push("/")
        router.refresh()
      }}
    >
      {label}
    </button>
  )
}
