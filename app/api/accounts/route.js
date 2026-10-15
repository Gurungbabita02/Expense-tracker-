import { NextResponse } from 'next/server';
import * as db from '../../../lib/db';
import { route, bad } from '../../../lib/handler';
import { parseAccount } from '../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ uid }) => db.listAccounts(uid));

export const POST = route(async ({ uid, b }) => {
  const { error, value } = parseAccount(b);
  if (error) return bad(error);
  if ((await db.listAccounts(uid)).length >= 30) return bad('You can have up to 30 accounts');
  return NextResponse.json(await db.createAccount(uid, value), { status: 201 });
}, { body: true });
