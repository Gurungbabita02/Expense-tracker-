// Wraps an API route: authenticates, parses the JSON body safely, and turns thrown errors into JSON.
import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from './auth';
import { ensureDefaults, listCategories, listAccounts, listGoals } from './db';

export const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export function route(fn, { body = false } = {}) {
  return async (req, ctx) => {
    try {
      const u = await currentUser();
      if (!u) return unauthorized();
      const uid = u._id.toString();
      await ensureDefaults(uid);
      let b;
      if (body) {
        try { b = await req.json(); } catch { return bad('Invalid JSON body'); }
        if (!b || typeof b !== 'object' || Array.isArray(b)) return bad('Body must be a JSON object');
      }
      const out = await fn({ req, u, uid, b, params: ctx?.params || {}, sp: new URL(req.url).searchParams });
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      console.error(e);
      return bad(process.env.NODE_ENV === 'development' ? e.message : 'Database error', 500);
    }
  };
}

// What parseTransaction needs to check ids and category names against this user's own data
export async function txContext(uid) {
  const [cats, accounts, goals] = await Promise.all([listCategories(uid), listAccounts(uid), listGoals(uid)]);
  return {
    cats: new Map(cats.map((c) => [c.name + '|' + c.type, c])),
    accounts: new Map(accounts.map((a) => [a.id, a])),
    goals: new Map(goals.map((g) => [g.id, g])),
    defaultAccountId: (accounts.find((a) => !a.archived) || accounts[0])?.id,
  };
}
