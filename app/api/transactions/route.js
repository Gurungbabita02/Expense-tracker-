import * as db from '../../../lib/db';
import { route, txContext, bad } from '../../../lib/handler';
import { parseTransaction, TYPES } from '../../../lib/validate';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/transactions?type=&q=&month=YYYY-MM&accountId=
export const GET = route(async ({ uid, sp }) => {
  const type = sp.get('type');
  return db.listTransactions(uid, {
    type: TYPES.includes(type) ? type : undefined,
    q: (sp.get('q') || '').slice(0, 60) || undefined,
    month: sp.get('month') || undefined,
    accountId: sp.get('accountId') || undefined,
  });
});

// POST /api/transactions  { type, amt, cat, note?, date?, accountId?, goalId?, toAccountId? }
export const POST = route(async ({ uid, b }) => {
  const { error, value } = parseTransaction(b, await txContext(uid));
  if (error) return bad(error);
  return NextResponse.json(await db.createTransaction(uid, value), { status: 201 });
}, { body: true });
