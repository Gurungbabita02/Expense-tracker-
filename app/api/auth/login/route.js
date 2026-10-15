import { NextResponse } from 'next/server';
import { findUserByEmail, publicUser } from '../../../../lib/db';
import { checkPassword, withSession, throttled, noteFailure, clearFailures } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const key = (req.headers.get('x-forwarded-for') || 'local') + '|' + email;
  if (throttled(key)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  try {
    const user = email && (await findUserByEmail(email));
    // Same message for unknown email and wrong password (no account enumeration)
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      noteFailure(key);
      return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 });
    }
    clearFailures(key);
    return withSession(NextResponse.json(publicUser(user)), user._id.toString(), req);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
