import * as db from '../../../../lib/db';
import { route } from '../../../../lib/handler';
import { isISODate } from '../../../../lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST { today } -> creates the transactions for every recurring rule that is due. Safe to call repeatedly.
export const POST = route(async ({ uid, b }) => {
  const today = isISODate(b.today) ? b.today : new Date().toISOString().slice(0, 10);
  return { created: await db.runRecurring(uid, today) };
}, { body: true });
