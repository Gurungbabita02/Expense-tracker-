import { NextResponse } from 'next/server';
import { COOKIE, verifySession } from './lib/session';

const PUBLIC_API = ['/api/auth/login', '/api/auth/register', '/api/auth/logout'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_API.includes(pathname)) return NextResponse.next();
  const uid = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!uid) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (pathname !== '/login') return NextResponse.redirect(new URL('/login', req.url));
  } else if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/|favicon.ico).*)'] };
