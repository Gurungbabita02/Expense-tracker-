import * as db from '../../../lib/db';
import { route, bad } from '../../../lib/handler';
import { isMonth, shiftMonth } from '../../../lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function view(uid, u, month) {
  const [cats, doc, prev] = await Promise.all([db.listCategories(uid), db.budgetFor(uid, month), db.budgetFor(uid, shiftMonth(month, -1))]);
  return { month, limits: db.resolveLimits(doc, cats, u), cap: doc?.cap ?? null, prevLimits: db.resolveLimits(prev, cats, u) };
}

// GET /api/budgets?month=YYYY-MM -> limits for that month (+ previous month's, used for rollover)
export const GET = route(async ({ uid, u, sp }) => {
  const month = sp.get('month');
  if (!isMonth(month)) return bad('month must look like 2026-10');
  return view(uid, u, month);
});

// PUT { month, limits: { Food: 9000 }, cap: 50000 | null } -> applies from that month onward
export const PUT = route(async ({ uid, u, b }) => {
  if (!isMonth(b.month)) return bad('month must look like 2026-10');
  const cats = await db.listCategories(uid);
  const names = new Set(cats.filter((c) => c.type === 'expense' && !c.archived).map((c) => c.name));
  const clean = {};
  for (const [k, v] of Object.entries(b.limits && typeof b.limits === 'object' ? b.limits : {})) {
    if (!names.has(k)) return bad(`Unknown category ${k}`);
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1e9) return bad(`Invalid budget for ${k}`);
    clean[k] = Math.round(n);
  }
  let cap = null;
  if (b.cap !== null && b.cap !== undefined && b.cap !== '') {
    cap = Number(b.cap);
    if (!Number.isFinite(cap) || cap < 0 || cap > 1e10) return bad('Invalid monthly cap');
    cap = cap > 0 ? Math.round(cap) : null;
  }
  const base = db.resolveLimits(await db.budgetFor(uid, b.month), cats, u);
  await db.saveBudget(uid, b.month, { ...base, ...clean }, cap);
  return view(uid, u, b.month);
}, { body: true });
