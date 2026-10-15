import { NextResponse } from 'next/server';
import * as db from '../../../lib/db';
import { route, bad } from '../../../lib/handler';
import { parseGoal } from '../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ uid }) => db.listGoals(uid));

export const POST = route(async ({ uid, b }) => {
  const { error, value } = parseGoal(b);
  if (error) return bad(error);
  if ((await db.listGoals(uid)).length >= 50) return bad('You can have up to 50 goals');
  return NextResponse.json(await db.createGoal(uid, value), { status: 201 });
}, { body: true });
