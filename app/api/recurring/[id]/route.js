import * as db from '../../../../lib/db';
import { route, txContext, bad } from '../../../../lib/handler';
import { parseRecurring } from '../../../../lib/validate';
import { isISODate } from '../../../../lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PUT = route(async ({ uid, b, params }) => {
  const old = await db.getRecurring(uid, params.id);
  if (!old) return bad('Not found', 404);
  const { error, value } = parseRecurring(b, await txContext(uid));
  if (error) return bad(error);
  return db.updateRecurring(uid, params.id, value, old);
}, { body: true });

// PATCH { active: boolean, today? } pauses or resumes a rule (resuming skips what was missed)
export const PATCH = route(async ({ uid, b, params }) => {
  const old = await db.getRecurring(uid, params.id);
  if (!old) return bad('Not found', 404);
  if (typeof b.active !== 'boolean') return bad('active must be true or false');
  const today = isISODate(b.today) ? b.today : new Date().toISOString().slice(0, 10);
  return db.setRecurringActive(uid, params.id, b.active, old, today);
}, { body: true });

export const DELETE = route(async ({ uid, params }) =>
  (await db.deleteRecurring(uid, params.id)) ? { ok: true } : bad('Not found', 404));
