import { NextResponse } from 'next/server';
import * as db from '../../../lib/db';
import { route, bad } from '../../../lib/handler';
import { parseCategory } from '../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async ({ uid }) => db.listCategories(uid));

export const POST = route(async ({ uid, b }) => {
  const { error, value } = parseCategory(b);
  if (error) return bad(error);
  try { return NextResponse.json(await db.createCategory(uid, value), { status: 201 }); }
  catch (e) { if (db.dupKey(e)) return bad('You already have a category with that name', 409); throw e; }
}, { body: true });
