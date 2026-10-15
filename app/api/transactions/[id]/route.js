import * as db from '../../../../lib/db';
import { route, txContext, bad } from '../../../../lib/handler';
import { parseTransaction } from '../../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async ({ uid, b, params }) => {
  const { error, value } = parseTransaction(b, await txContext(uid));
  if (error) return bad(error);
  const tx = await db.updateTransaction(uid, params.id, value);
  return tx || bad('Not found', 404);
}, { body: true });

export const DELETE = route(async ({ uid, params }) =>
  (await db.deleteTransaction(uid, params.id)) ? { ok: true } : bad('Not found', 404));
