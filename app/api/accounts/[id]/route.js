import * as db from '../../../../lib/db';
import { route, bad } from '../../../../lib/handler';
import { parseAccount } from '../../../../lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUT { name, type, emoji?, opening } or { archived: boolean }
export const PUT = route(async ({ uid, b, params }) => {
  const old = await db.getAccount(uid, params.id);
  if (!old) return bad('Not found', 404);
  if (typeof b.archived === 'boolean' && b.name === undefined) {
    if (b.archived && !(await db.listAccounts(uid)).some((a) => a.id !== old.id && !a.archived)) return bad('Keep at least one active account');
    return db.setAccountArchived(uid, params.id, b.archived);
  }
  const { error, value } = parseAccount(b);
  if (error) return bad(error);
  return (await db.updateAccount(uid, params.id, value)) || bad('Not found', 404);
}, { body: true });

// Accounts with history are archived; unused ones are removed.
export const DELETE = route(async ({ uid, params }) => {
  const old = await db.getAccount(uid, params.id);
  if (!old) return bad('Not found', 404);
  if (!(await db.listAccounts(uid)).some((a) => a.id !== old.id && !a.archived)) return bad('Keep at least one active account');
  if (await db.accountInUse(uid, old.id)) { await db.setAccountArchived(uid, params.id, true); return { archived: true }; }
  await db.deleteAccount(uid, params.id);
  return { deleted: true };
});
