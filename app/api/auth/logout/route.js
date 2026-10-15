import { NextResponse } from 'next/server';
import { COOKIE, cookieOpts, isHttps } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, '', cookieOpts(0, isHttps(req)));
  return res;
}
