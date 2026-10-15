import * as db from '../../../../lib/db';
import { route, bad } from '../../../../lib/handler';
import { parseCategory } from '../../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT { name?, emoji?, color?, budget?, archived? }
export const PUT = route(async ({ uid, b, params }) => {
  const old = await db.getCategory(uid, params.id);
  if (!old) return bad('Not found', 404);
  const { error, value } = parseCategory(b, { partial: true });
  if (error) return bad(error);
  if (typeof b.archived === 'boolean') value.archived = b.archived;
  if (old.type === 'income') delete value.budget;
  if (!Object.keys(value).length) return bad('Nothing to update');
  try { return (await db.updateCategory(uid, params.id, value, old)) || bad('Not found', 404); }
  catch (e) { if (db.dupKey(e)) return bad('You already have a category with that name', 409); throw e; }
}, { body: true });

// Categories with history are archived (hidden from pickers); unused ones are removed.
export const DELETE = route(async ({ uid, params }) => {
  const c = await db.getCategory(uid, params.id);
  if (!c) return bad('Not found', 404);
  if (await db.categoryInUse(uid, c)) { await db.setCategoryArchived(uid, params.id, true); return { archived: true }; }
  await db.deleteCategory(uid, params.id);
  return { deleted: true };
});
