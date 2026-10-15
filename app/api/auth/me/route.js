import { NextResponse } from 'next/server';
import { currentUser, unauthorized, hashPassword, checkPassword } from '../../../../lib/auth';
import { publicUser, updateUser } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const u = await currentUser();
    return u ? NextResponse.json(publicUser(u)) : unauthorized();
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Database error' }, { status: 500 }); }
}

// PATCH { name? } and/or { currentPassword, newPassword }
export async function PATCH(req) {
  try {
    const u = await currentUser();
    if (!u) return unauthorized();
    let b; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
    if (!b || typeof b !== 'object') return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const set = {};
    if (b.name !== undefined) {
      const name = String(b.name).trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      set.name = name;
    }
    if (b.newPassword !== undefined) {
      if (String(b.newPassword).length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
      if (!(await checkPassword(String(b.currentPassword || ''), u.passwordHash))) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
      set.passwordHash = await hashPassword(String(b.newPassword));
    }
    if (!Object.keys(set).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    await updateUser(u._id.toString(), set);
    return NextResponse.json(publicUser({ ...u, ...set }));
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Database error' }, { status: 500 }); }
}
