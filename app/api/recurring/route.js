import { NextResponse } from 'next/server';
import * as db from '../../../lib/db';
import { route, txContext, bad } from '../../../lib/handler';
import { parseRecurring } from '../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ uid }) => db.listRecurring(uid));

// POST { type, amt, cat, note?, accountId?, goalId?, toAccountId?, frequency, startDate, endDate? }
export const POST = route(async ({ uid, b }) => {
  const { error, value } = parseRecurring(b, await txContext(uid));
  if (error) return bad(error);
  if ((await db.listRecurring(uid)).length >= 100) return bad('You can have up to 100 recurring rules');
  return NextResponse.json(await db.createRecurring(uid, value), { status: 201 });
}, { body: true });
