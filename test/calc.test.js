import { describe, it, expect } from 'vitest';
import { monthStats, accountBalances, savedByGoal, goalPlan, emergency, insights, budgetRows, rateSeries } from '../lib/calc';

const T = (type, amt, date, extra = {}) => ({ id: Math.random().toString(), type, amt, date, cat: extra.cat || 'Food', accountId: 'a1', ...extra });

describe('monthStats', () => {
  const tx = [T('income', 1000, '2026-10-01'), T('expense', 300, '2026-10-05'), T('saving', 200, '2026-10-06', { cat: 'Savings' }),
    T('transfer', 999, '2026-10-07', { toAccountId: 'a2' }), T('expense', 50, '2026-09-30')];
  it('ignores transfers and other months', () => {
    expect(monthStats(tx, '2026-10')).toEqual({ income: 1000, expense: 300, saved: 200, rate: 70 });
  });
  it('rate is null with no income and negative when overspending', () => {
    expect(monthStats([T('expense', 10, '2026-10-01')], '2026-10').rate).toBeNull();
    expect(monthStats([T('income', 100, '2026-10-01'), T('expense', 150, '2026-10-02')], '2026-10').rate).toBe(-50);
  });
});

describe('accountBalances', () => {
  const accounts = [{ id: 'a1', opening: 500 }, { id: 'a2', opening: 0 }];
  it('applies income, spending, savings and transfers', () => {
    const tx = [T('income', 1000, '2026-10-01'), T('expense', 200, '2026-10-02'), T('saving', 100, '2026-10-03', { cat: 'Savings' }),
      T('transfer', 300, '2026-10-04', { toAccountId: 'a2', cat: 'Transfer' })];
    expect(accountBalances(accounts, tx)).toEqual({ a1: 900, a2: 300 });
  });
  it('treats transactions without an account as the first active account', () => {
    expect(accountBalances(accounts, [{ type: 'expense', amt: 50, date: '2026-10-01' }]).a1).toBe(450);
  });
  it('total across accounts is unchanged by a transfer', () => {
    const tx = [T('transfer', 300, '2026-10-04', { toAccountId: 'a2' })];
    const b = accountBalances(accounts, tx);
    expect(b.a1 + b.a2).toBe(500);
  });
});

describe('goals', () => {
  it('sums savings per goal and keeps general savings separate', () => {
    const tx = [T('saving', 100, '2026-10-01', { goalId: 'g1' }), T('saving', 50, '2026-10-02', { goalId: 'g1' }), T('saving', 25, '2026-10-03')];
    expect(savedByGoal(tx)).toEqual({ by: { g1: 150 }, total: 175, general: 25 });
  });
  it('plans a monthly amount and flags late goals', () => {
    const p = goalPlan({ target: 60000, targetDate: '2027-04-14' }, 6000, '2026-10-14');
    expect(p.remaining).toBe(54000);
    expect(Math.round(p.perMonth)).toBe(Math.round(54000 / (182 / 30.44)));
    expect(goalPlan({ target: 100, targetDate: '2026-01-01' }, 10, '2026-10-14').late).toBe(true);
    expect(goalPlan({ target: 100 }, 100, '2026-10-14')).toMatchObject({ done: true, pct: 100 });
  });
});

describe('emergency fund', () => {
  it('divides emergency savings by the average of recent full months', () => {
    const goals = [{ id: 'e', kind: 'emergency' }, { id: 'x', kind: 'general' }];
    const tx = [T('saving', 30000, '2026-09-10', { goalId: 'e' }), T('saving', 99999, '2026-09-10', { goalId: 'x' }),
      T('expense', 10000, '2026-09-05'), T('expense', 20000, '2026-08-05'), T('expense', 99999, '2026-10-02')];
    const r = emergency(goals, tx, '2026-10-14');
    expect(r).toMatchObject({ hasGoal: true, saved: 30000, avg: 15000, partial: false, covered: 2 });
  });
  it('falls back to the current month when there is no history', () => {
    const r = emergency([{ id: 'e', kind: 'emergency' }], [T('expense', 1000, '2026-10-02'), T('saving', 2000, '2026-10-03', { goalId: 'e' })], '2026-10-14');
    expect(r).toMatchObject({ partial: true, covered: 2 });
  });
  it('reports no goal', () => expect(emergency([], [], '2026-10-14').hasGoal).toBe(false));
});

describe('insights', () => {
  it('compares current month to the same day last month', () => {
    const tx = [T('expense', 1000, '2026-09-05'), T('expense', 9000, '2026-09-25'), T('expense', 1500, '2026-10-05')];
    const out = insights(tx, '2026-10', '2026-10-14');
    expect(out[0].text).toContain('₹500 more');
    expect(out[0].text).toContain('so far');
    expect(out[0].text).not.toContain('9,000');
  });
  it('compares whole months for past months and lists category movers', () => {
    const tx = [T('expense', 1000, '2026-08-05', { cat: 'Food' }), T('expense', 2000, '2026-09-05', { cat: 'Food' }), T('expense', 3000, '2026-09-06', { cat: 'Fun' })];
    const out = insights(tx, '2026-09', '2026-10-14').map((i) => i.text);
    expect(out.some((t) => t.includes('Food is up 100%'))).toBe(true);
    expect(out.some((t) => t.includes('New this month: Fun'))).toBe(true);
  });
  it('is quiet when there is nothing to compare', () => expect(insights([], '2026-10', '2026-10-14')).toEqual([]));
});

describe('budgetRows', () => {
  const cats = [{ name: 'Food', type: 'expense' }, { name: 'Old', type: 'expense', archived: true }, { name: 'Salary', type: 'income' }];
  it('hides archived categories without spend and excludes income', () => {
    expect(budgetRows(cats, [], '2026-10', { Food: 100 }, {}, false).map((r) => r.cat.name)).toEqual(['Food']);
  });
  it('carries unspent budget forward only when rollover is on', () => {
    const tx = [T('expense', 600, '2026-09-10'), T('expense', 300, '2026-10-10')];
    const on = budgetRows(cats, tx, '2026-10', { Food: 1000 }, { Food: 1000 }, true)[0];
    expect(on).toMatchObject({ carry: 400, eff: 1400, spent: 300 });
    expect(budgetRows(cats, tx, '2026-10', { Food: 1000 }, { Food: 1000 }, false)[0].carry).toBe(0);
  });
  it('never carries a negative amount', () => {
    const tx = [T('expense', 1500, '2026-09-10')];
    expect(budgetRows(cats, tx, '2026-10', { Food: 1000 }, { Food: 1000 }, true)[0].carry).toBe(0);
  });
});

describe('rateSeries', () => {
  it('returns six months ending at the chosen month', () => {
    const s = rateSeries([], '2026-10');
    expect(s.map((x) => x.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  });
});
