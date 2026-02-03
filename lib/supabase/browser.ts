// lib/supabase/browser.ts
import { createBrowserClient } from "@supabase/ssr"

type BrowserClient = ReturnType<typeof createBrowserClient>

declare global {
  interface Window {
    __supabaseBrowserClient?: BrowserClient
    __supabaseBrowserClientNoAuth?: BrowserClient
  }
}

export function createBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!window.__supabaseBrowserClient) {
    window.__supabaseBrowserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return window.__supabaseBrowserClient
}

export function createBrowserSupabaseClientNoAuth() {
  if (typeof window === "undefined") {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          storageKey: "sb-noauth",
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          },
        },
      }
    )
  }

  if (!window.__supabaseBrowserClientNoAuth) {
    const memoryStore = new Map<string, string>()
    window.__supabaseBrowserClientNoAuth = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
          storageKey: "sb-noauth",
          storage: {
            getItem: (key: string) => memoryStore.get(key) ?? null,
            setItem: (key: string, value: string) => {
              memoryStore.set(key, value)
            },
            removeItem: (key: string) => {
              memoryStore.delete(key)
            },
          },
        },
      }
    )
  }

  return window.__supabaseBrowserClientNoAuth
}
