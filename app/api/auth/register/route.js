import { NextResponse } from 'next/server';
import { createUser, publicUser } from '../../../../lib/db';
import { hashPassword, withSession } from '../../../../lib/auth';
import { validEmail } from '../../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  let b; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const name = String(b.name || '').trim().slice(0, 60);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  if (!name) return NextResponse.json({ error: 'Please enter your name' }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  try {
    const user = await createUser({ name, email, passwordHash: await hashPassword(password) });
    return withSession(NextResponse.json(publicUser(user), { status: 201 }), user._id.toString(), req);
  } catch (e) {
if (
  e?.code === 11000 &&
  (e?.keyPattern?.email || e?.keyValue?.email)
) {
  return NextResponse.json(
    { error: 'An account with this email already exists' },
    { status: 409 }
  );
}    console.error(e);
    return NextResponse.json({ error: 'Could not create account' }, { status: 500 });
  }
}
