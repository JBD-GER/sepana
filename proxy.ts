import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type Role = 'customer' | 'advisor' | 'admin'

function hasPrefixSegment(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(base + '/')
}

function isProtectedPath(pathname: string) {
  return (
    hasPrefixSegment(pathname, '/app') ||
    hasPrefixSegment(pathname, '/advisor') ||
    hasPrefixSegment(pathname, '/admin')
  )
}

function roleHome(r: Role) {
  return r === 'admin' ? '/admin' : r === 'advisor' ? '/advisor' : '/app'
}

function isAllowedNext(r: Role, nextPath: string) {
  if (!nextPath || !nextPath.startsWith('/')) return false
  if (nextPath.startsWith('/login')) return false

  if (hasPrefixSegment(nextPath, '/admin')) return r === 'admin'
  if (hasPrefixSegment(nextPath, '/advisor')) return r === 'advisor' || r === 'admin'
  if (hasPrefixSegment(nextPath, '/app')) return r === 'customer'
  return true
}

export async function proxy(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { pathname, search } = req.nextUrl

  // ✅ robust: liest die Session aus den Cookies (wenn vorhanden)
  const { data: { user } } = await supabase.auth.getUser()

  // not logged in -> protected -> /login?next=...
  if (!user && isProtectedPath(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname + search)
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: role } = await supabase.rpc('get_my_role')
    const r = (role ?? 'customer') as Role

    // logged in -> /login -> redirect to allowed next or home
    if (pathname === '/login') {
      const next = req.nextUrl.searchParams.get('next') || ''
      const dest = next && isAllowedNext(r, next) ? next : roleHome(r)

      const url = req.nextUrl.clone()
      url.pathname = dest
      url.search = ''
      return NextResponse.redirect(url)
    }

    // guards
    if (hasPrefixSegment(pathname, '/admin') && r !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = roleHome(r)
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (hasPrefixSegment(pathname, '/advisor') && !(r === 'advisor' || r === 'admin')) {
      const url = req.nextUrl.clone()
      url.pathname = '/app'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (hasPrefixSegment(pathname, '/app') && (r === 'admin' || r === 'advisor')) {
      const url = req.nextUrl.clone()
      url.pathname = roleHome(r)
      url.search = ''
      return NextResponse.redirect(url)
    }
  }

  return res
}

// ✅ WICHTIG: Hier nicht auf "matcher regex" verlassen.
// Wenn dein Proxy als Middleware-ähnlich läuft, filterst du Icons besser direkt in deinem "Proxy Hook".
// Falls du wirklich Next middleware matcher nutzt: lass das hier drin:
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png|icon.png|site.webmanifest|robots.txt|sitemap.xml).*)',
  ],
}
