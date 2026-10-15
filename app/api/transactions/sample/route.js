import { NextResponse } from 'next/server';
import * as db from '../../../../lib/db';
import { route, bad } from '../../../../lib/handler';
import { isISODate } from '../../../../lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/transactions/sample  { today } -> demo transactions, two goals and some savings
export const POST = route(async ({ uid, b }) => {
  const today = isISODate(b.today) ? b.today : new Date().toISOString().slice(0, 10);
  try { await db.insertSample(uid, today); } catch (e) { if (e.status === 400) return bad('You already have plenty of data'); throw e; }
  return NextResponse.json({ ok: true }, { status: 201 });
}, { body: true });
