import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function isProtectedPath(pathname: string) {
  return pathname.startsWith('/app') || pathname.startsWith('/advisor') || pathname.startsWith('/admin')
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
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  const { pathname } = req.nextUrl

  if (!session && isProtectedPath(pathname)) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (session) {
    const { data: role } = await supabase.rpc('get_my_role')
    const r = (role ?? 'customer') as 'customer' | 'advisor' | 'admin'

    if (pathname === '/login') {
      const url = req.nextUrl.clone()
      url.pathname = r === 'admin' ? '/admin' : r === 'advisor' ? '/advisor' : '/app'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/admin') && r !== 'admin') {
      const url = req.nextUrl.clone()
      url.pathname = r === 'advisor' ? '/advisor' : '/app'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/advisor') && !(r === 'advisor' || r === 'admin')) {
      const url = req.nextUrl.clone()
      url.pathname = '/app'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/app') && (r === 'admin' || r === 'advisor')) {
      const url = req.nextUrl.clone()
      url.pathname = r === 'admin' ? '/admin' : '/advisor'
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
