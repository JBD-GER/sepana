"use client"

import * as React from "react"

export const ACCENT = "#091840"

export function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ")
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-6 shadow-sm sm:p-8">
      {children}
    </div>
  )
}

export function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-slate-800">{children}</span>
}

export function Input({
  error,
  leftIcon,
  rightSlot,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  error?: string | null
  leftIcon?: React.ReactNode
  rightSlot?: React.ReactNode
}) {
  return (
    <div className="grid gap-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 shadow-sm transition",
          error ? "border-rose-300 focus-within:border-rose-400" : "border-slate-200/80 focus-within:border-slate-300"
        )}
      >
        {leftIcon && <div className="text-slate-500">{leftIcon}</div>}
        <input
          {...props}
          className={cn(
            "w-full bg-transparent text-sm outline-none placeholder:text-slate-400",
            className
          )}
        />
        {rightSlot}
      </div>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  )
}

export function Button({
  children,
  loading,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: "primary" | "soft"
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-sm transition active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"

  const styles =
    variant === "primary"
      ? "text-white hover:opacity-95"
      : "border border-slate-200/80 bg-white text-slate-900 hover:bg-slate-50"

  return (
    <button
      {...props}
      className={cn(base, styles, className)}
      style={variant === "primary" ? { backgroundColor: ACCENT } : undefined}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  )
}

export function Alert({
  type,
  title,
  children,
}: {
  type: "ok" | "err" | "info"
  title?: string
  children: React.ReactNode
}) {
  const map =
    type === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : type === "err"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-slate-200 bg-slate-50 text-slate-900"

  return (
    <div className={cn("rounded-2xl border px-3 py-2 text-sm", map)}>
      {title ? <div className="font-medium">{title}</div> : null}
      <div className={cn(title ? "mt-1" : "")}>{children}</div>
    </div>
  )
}

export function DividerText({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-slate-200/80" />
      <div className="text-xs text-slate-500">{children}</div>
      <div className="h-px flex-1 bg-slate-200/80" />
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm text-slate-700">{children}</span>
    </label>
  )
}

export function PasswordStrength({ value }: { value: string }) {
  const score = useScore(value)
  const label =
    score >= 4 ? "Sehr stark" : score === 3 ? "Stark" : score === 2 ? "Okay" : score === 1 ? "Schwach" : "—"
  const pct = (score / 4) * 100

  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: ACCENT }} />
      </div>
      <div className="mt-1 text-xs text-slate-500">Passwort-Stärke: {label}</div>
    </div>
  )
}

function useScore(v: string) {
  let s = 0
  if (v.length >= 8) s++
  if (/[A-Z]/.test(v)) s++
  if (/[0-9]/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v)) s++
  return s
}

export function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/50 border-t-white"
      aria-hidden
    />
  )
}

export function Icon({
  name,
  className,
}: {
  name: "mail" | "lock" | "eye" | "eyeOff" | "shield" | "arrow" | "spark"
  className?: string
}) {
  const cls = cn("h-5 w-5", className)
  switch (name) {
    case "mail":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4.5 6.8h15v10.4h-15V6.8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path
            d="M5.2 7.5 12 12.6l6.8-5.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "lock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M7.5 11V8.6c0-2.7 2-4.8 4.5-4.8s4.5 2.1 4.5 4.8V11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M6.8 11h10.4c.9 0 1.6.7 1.6 1.6v6.6c0 .9-.7 1.6-1.6 1.6H6.8c-.9 0-1.6-.7-1.6-1.6v-6.6c0-.9.7-1.6 1.6-1.6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "eye":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M2.5 12s3.6-7 9.5-7 9.5 7 9.5 7-3.6 7-9.5 7-9.5-7-9.5-7Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
      )
    case "eyeOff":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 5.2 20 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M9.2 9.6a3.2 3.2 0 0 0 4.2 4.2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M6.3 7.6C3.8 9.5 2.5 12 2.5 12s3.6 7 9.5 7c2.2 0 4.1-.6 5.7-1.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M20.2 16.5C21.1 15.3 21.5 14 21.5 14S17.9 7 12 7c-.9 0-1.8.1-2.6.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )
    case "shield":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2.5 20 6.5v6.7c0 5-3.4 8.2-8 9.8-4.6-1.6-8-4.8-8-9.8V6.5l8-4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 12.2l1.9 1.9 3.9-4.1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "arrow":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M13 7l5 5-5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case "spark":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2l1.3 5.2L18 8.5l-4.7 1.3L12 15l-1.3-5.2L6 8.5l4.7-1.3L12 2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M19 13l.7 2.6 2.3.7-2.3.7L19 19l-.7-2.6-2.3-.7 2.3-.7L19 13Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}
