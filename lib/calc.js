// Pure calculations used by the dashboard (no React, no DB), so they can be unit-tested.
import { ym, shiftMonth, daysBetween } from './dates';
import { fm } from './format';
import { SPECIAL } from './categories';

const n = (v) => Number(v) || 0;
const dayOf = (d) => Number(String(d).slice(8, 10));

export function makeCatOf(cats) {
  const m = new Map(cats.map((c) => [c.name + '|' + c.type, c]));
  return (name, type) => SPECIAL[name] || m.get(name + '|' + type) || { emoji: '•', color: '#8A9A94' };
}

export function monthStats(tx, month) {
  let income = 0, expense = 0, saved = 0;
  for (const t of tx) {
    if (ym(t.date) !== month) continue;
    if (t.type === 'income') income += n(t.amt);
    else if (t.type === 'expense') expense += n(t.amt);
    else if (t.type === 'saving') saved += n(t.amt);
  }
  // savings rate = share of income you kept (income - spending), so it can go negative when you overspend
  const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : null;
  return { income, expense, saved, rate };
}

export function expenseByCat(tx, month) {
  const by = {};
  for (const t of tx) if (t.type === 'expense' && ym(t.date) === month) by[t.cat] = (by[t.cat] || 0) + n(t.amt);
  return by;
}

// Money in each account: opening balance + income - spending - money set aside +/- transfers
export function accountBalances(accounts, tx) {
  const bal = {};
  for (const a of accounts) bal[a.id] = n(a.opening);
  const def = (accounts.find((a) => !a.archived) || accounts[0])?.id;
  for (const t of tx) {
    const from = t.accountId || def, amt = n(t.amt);
    if (!(from in bal)) continue;
    if (t.type === 'income') bal[from] += amt;
    else if (t.type === 'transfer') { bal[from] -= amt; if (t.toAccountId in bal) bal[t.toAccountId] += amt; }
    else bal[from] -= amt; // expense or saving
  }
  return bal;
}

export function savedByGoal(tx) {
  const by = {}; let total = 0, general = 0;
  for (const t of tx) {
    if (t.type !== 'saving') continue;
    const a = n(t.amt); total += a;
    if (t.goalId) by[t.goalId] = (by[t.goalId] || 0) + a; else general += a;
  }
  return { by, total, general };
}

export function goalPlan(goal, saved, today) {
  const remaining = Math.max(0, n(goal.target) - saved);
  const pct = goal.target > 0 ? Math.min(100, (saved / goal.target) * 100) : 0;
  const done = remaining === 0;
  let perMonth = null, daysLeft = null, late = false;
  if (goal.targetDate) {
    daysLeft = daysBetween(today, goal.targetDate);
    late = daysLeft < 0 && !done;
    if (!done && daysLeft >= 0) perMonth = remaining / Math.max(1, daysLeft / 30.44);
  }
  return { remaining, pct, done, perMonth, daysLeft, late };
}

export function emergency(goals, tx, today) {
  const ids = new Set(goals.filter((g) => g.kind === 'emergency').map((g) => g.id));
  const saved = tx.filter((t) => t.type === 'saving' && ids.has(t.goalId)).reduce((s, t) => s + n(t.amt), 0);
  const cur = ym(today);
  const spend = (m) => monthStats(tx, m).expense;
  const full = [];
  for (let i = 1; i <= 6 && full.length < 3; i++) { const e = spend(shiftMonth(cur, -i)); if (e > 0) full.push(e); }
  let avg = 0, partial = false;
  if (full.length) avg = full.reduce((a, b) => a + b, 0) / full.length;
  else if (spend(cur) > 0) { avg = spend(cur); partial = true; }
  return { hasGoal: ids.size > 0, saved, avg, partial, covered: avg > 0 ? saved / avg : null };
}

export function rateSeries(tx, month, count = 6) {
  return [...Array(count)].map((_, i) => {
    const m = shiftMonth(month, i - (count - 1));
    return { month: m, ...monthStats(tx, m) };
  });
}

// Plain-language comparison with the previous month. For the current month it compares
// "so far" against the same day last month, so a half-finished month isn't judged against a full one.
export function insights(tx, month, today) {
  const prev = shiftMonth(month, -1);
  const cutoff = month === ym(today) ? dayOf(today) : 31;
  const pick = (m) => tx.filter((t) => ym(t.date) === m && dayOf(t.date) <= cutoff);
  const cur = pick(month), prv = pick(prev);
  const sum = (a, type) => a.filter((t) => t.type === type).reduce((s, t) => s + n(t.amt), 0);
  const cats = (a) => { const by = {}; a.filter((t) => t.type === 'expense').forEach((t) => (by[t.cat] = (by[t.cat] || 0) + n(t.amt))); return by; };
  const out = [];
  const so = month === ym(today) ? ' so far' : '';
  const e1 = sum(cur, 'expense'), e0 = sum(prv, 'expense');

  if (e1 || e0) {
    if (!e0) out.push({ tone: 'neutral', text: `You've spent ${fm(e1)}${so}. Nothing was recorded for the same period last month.` });
    else {
      const d = e1 - e0, p = Math.round((Math.abs(d) / e0) * 100);
      if (p < 3) out.push({ tone: 'neutral', text: `Spending${so} is about the same as last month (${fm(e1)}).` });
      else out.push({ tone: d > 0 ? 'bad' : 'good', text: `You've spent ${fm(Math.abs(d))} ${d > 0 ? 'more' : 'less'}${so} than last month (${d > 0 ? '+' : '−'}${p}%).` });
    }
  }
  const c1 = cats(cur), c0 = cats(prv);
  const movers = [...new Set([...Object.keys(c1), ...Object.keys(c0)])]
    .map((k) => ({ k, a: c1[k] || 0, b: c0[k] || 0 }))
    .map((x) => ({ ...x, d: x.a - x.b }))
    .filter((x) => Math.abs(x.d) >= 200 && (x.b === 0 || Math.abs(x.d) / x.b >= 0.15))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
  for (const x of movers) {
    if (x.b === 0) out.push({ tone: 'neutral', text: `New this month: ${x.k} (${fm(x.a)}).` });
    else if (x.a === 0) out.push({ tone: 'good', text: `No ${x.k} spending${so}, compared with ${fm(x.b)} last month.` });
    else out.push({ tone: x.d > 0 ? 'bad' : 'good', text: `${x.k} is ${x.d > 0 ? 'up' : 'down'} ${Math.round((Math.abs(x.d) / x.b) * 100)}% (${fm(Math.abs(x.d))} ${x.d > 0 ? 'more' : 'less'}).` });
  }
  const i1 = sum(cur, 'income'), i0 = sum(prv, 'income');
  if (i1 && i0) {
    const p = Math.round(((i1 - i0) / i0) * 100);
    if (Math.abs(p) >= 3) out.push({ tone: p > 0 ? 'good' : 'bad', text: `Income is ${Math.abs(p)}% ${p > 0 ? 'higher' : 'lower'} than last month.` });
  }
  const s1 = sum(cur, 'saving'), s0 = sum(prv, 'saving');
  if (s1 || s0) {
    if (s1 >= s0) out.push({ tone: 'good', text: `You've set aside ${fm(s1)}${so}${s0 ? ` (last month: ${fm(s0)})` : ''}.` });
    else out.push({ tone: 'neutral', text: `You've set aside ${fm(s1)}${so}, down from ${fm(s0)} last month.` });
  }
  return out;
}

// Budget rows for a month. Carry-over (optional) adds last month's unspent amount to this month's limit.
export function budgetRows(cats, tx, month, limits, prevLimits, rollover) {
  const spent = expenseByCat(tx, month), prevSpent = expenseByCat(tx, shiftMonth(month, -1));
  return cats
    .filter((c) => c.type === 'expense' && (!c.archived || spent[c.name]))
    .map((c) => {
      const limit = n(limits[c.name]);
      const carry = rollover && n(prevLimits?.[c.name]) > 0 ? Math.max(0, n(prevLimits[c.name]) - (prevSpent[c.name] || 0)) : 0;
      const eff = limit + carry, s = spent[c.name] || 0;
      return { cat: c, limit, carry, eff, spent: s, pct: eff ? (s / eff) * 100 : s ? 101 : 0 };
    });
}
