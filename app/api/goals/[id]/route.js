import * as db from '../../../../lib/db';
import { route, bad } from '../../../../lib/handler';
import { parseGoal } from '../../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async ({ uid, b, params }) => {
  const { error, value } = parseGoal(b);
  if (error) return bad(error);
  return (await db.updateGoal(uid, params.id, value)) || bad('Not found', 404);
}, { body: true });

// Deleting a goal keeps its savings in your history as general savings.
export const DELETE = route(async ({ uid, params }) =>
  (await db.deleteGoal(uid, params.id)) ? { ok: true } : bad('Not found', 404));
