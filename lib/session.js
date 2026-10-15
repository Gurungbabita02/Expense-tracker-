// Edge-safe session helpers (used by middleware AND route handlers). Only depends on `jose`.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'pw_session';
export const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET is missing or too short (min 16 chars). Add it to .env.local');
  if (process.env.NODE_ENV === 'production' && (s.length < 32 || /change-me/i.test(s))) {
    throw new Error('JWT_SECRET is a placeholder or too short for production. Generate one with: openssl rand -hex 32');
  }
  return new TextEncoder().encode(s);
}

export const signSession = (userId) =>
  new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId)).setIssuedAt().setExpirationTime(MAX_AGE + 's').sign(secret());

export async function verifySession(token) {
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload.sub || null; } catch { return null; }
}

// `secure` must only be true when the browser is on HTTPS, otherwise it silently drops the cookie
// (this is what breaks login over http:// in `next start` or on a LAN IP).
export const isHttps = (req) =>
  req.nextUrl?.protocol === 'https:' || (req.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';

export const cookieOpts = (maxAge = MAX_AGE, secure = false) => ({
  httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge,
});
