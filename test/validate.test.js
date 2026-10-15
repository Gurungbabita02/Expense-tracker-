import { describe, it, expect } from 'vitest';
import { parseTransaction, parseRecurring, parseCategory, parseAccount, parseGoal, parseSettings } from '../lib/validate';

const ctx = {
  cats: new Map([['Food|expense', { name: 'Food', type: 'expense' }], ['Salary|income', { name: 'Salary', type: 'income' }], ['Pets|expense', { name: 'Pets', type: 'expense' }], ['Pets|income', { name: 'Pets', type: 'income' }]]),
  accounts: new Map([['a1', {}], ['a2', {}]]),
  goals: new Map([['g1', {}]]),
  defaultAccountId: 'a1',
};

describe('parseTransaction', () => {
  it('accepts an expense and defaults the account', () => {
    const r = parseTransaction({ type: 'expense', amt: '12.345', cat: 'Food', date: '2026-10-01', note: ' hi ' }, ctx);
    expect(r.value).toEqual({ type: 'expense', amt: 12.35, date: '2026-10-01', accountId: 'a1', note: 'hi', cat: 'Food' });
  });
  it('rejects bad amounts, dates, types and mismatched categories', () => {
    expect(parseTransaction({ type: 'expense', amt: 0, cat: 'Food' }, ctx).error).toMatch(/Amount/);
    expect(parseTransaction({ type: 'expense', amt: 1e12, cat: 'Food' }, ctx).error).toMatch(/too large/);
    expect(parseTransaction({ type: 'expense', amt: 5, cat: 'Food', date: '2026-99-99' }, ctx).error).toMatch(/date/);
    expect(parseTransaction({ type: 'nope', amt: 5 }, ctx).error).toMatch(/Type/);
    expect(parseTransaction({ type: 'income', amt: 5, cat: 'Food' }, ctx).error).toMatch(/Category/);
    expect(parseTransaction({ type: 'expense', amt: 5, cat: 'Food', accountId: 'zzz' }, ctx).error).toMatch(/account/);
  });
  it('same category name under both types resolves by type', () => {
    expect(parseTransaction({ type: 'income', amt: 5, cat: 'Pets' }, ctx).value.cat).toBe('Pets');
    expect(parseTransaction({ type: 'expense', amt: 5, cat: 'Pets' }, ctx).value.cat).toBe('Pets');
  });
  it('saving takes an optional goal and ignores the sent category', () => {
    expect(parseTransaction({ type: 'saving', amt: 5, cat: 'Hacked', goalId: 'g1' }, ctx).value).toMatchObject({ cat: 'Savings', goalId: 'g1' });
    expect(parseTransaction({ type: 'saving', amt: 5 }, ctx).value.goalId).toBeUndefined();
    expect(parseTransaction({ type: 'saving', amt: 5, goalId: 'nope' }, ctx).error).toMatch(/goal/);
  });
  it('transfer needs two different valid accounts', () => {
    expect(parseTransaction({ type: 'transfer', amt: 5, accountId: 'a1', toAccountId: 'a2' }, ctx).value).toMatchObject({ cat: 'Transfer', toAccountId: 'a2' });
    expect(parseTransaction({ type: 'transfer', amt: 5, accountId: 'a1', toAccountId: 'a1' }, ctx).error).toMatch(/different/);
    expect(parseTransaction({ type: 'transfer', amt: 5, accountId: 'a1' }, ctx).error).toMatch(/transfer to/);
  });
  it('does not let unknown fields through', () => {
    const v = parseTransaction({ type: 'expense', amt: 5, cat: 'Food', userId: 'evil', _id: 'x', recurringId: 'y' }, ctx).value;
    expect(v).not.toHaveProperty('userId'); expect(v).not.toHaveProperty('_id'); expect(v).not.toHaveProperty('recurringId');
  });
});

describe('parseRecurring', () => {
  const ok = { type: 'expense', amt: 999, cat: 'Food', frequency: 'monthly', startDate: '2026-10-05' };
  it('accepts a valid rule', () => expect(parseRecurring(ok, ctx).value).toMatchObject({ frequency: 'monthly', startDate: '2026-10-05', endDate: null, active: true }));
  it('rejects bad schedules', () => {
    expect(parseRecurring({ ...ok, frequency: 'daily' }, ctx).error).toMatch(/Frequency/);
    expect(parseRecurring({ ...ok, startDate: undefined }, ctx).error).toMatch(/start/);
    expect(parseRecurring({ ...ok, endDate: '2026-01-01' }, ctx).error).toMatch(/End date/);
  });
});

describe('parseCategory', () => {
  const ok = { name: 'Pets', type: 'expense', emoji: '🐶', color: '#112233', budget: 500 };
  it('accepts valid', () => expect(parseCategory(ok).value).toMatchObject({ name: 'Pets', key: 'pets', budget: 500 }));
  it('rejects unsafe or reserved names', () => {
    for (const name of ['a.b', '$x', '', 'x'.repeat(25), 'Savings', 'transfer']) expect(parseCategory({ ...ok, name }).error).toBeTruthy();
  });
  it('rejects bad colours and types', () => {
    expect(parseCategory({ ...ok, color: 'red' }).error).toMatch(/colour/);
    expect(parseCategory({ ...ok, type: 'saving' }).error).toMatch(/Type/);
  });
  it('partial updates only validate what is sent', () => expect(parseCategory({ budget: 10 }, { partial: true }).value).toEqual({ budget: 10 }));
});

describe('others', () => {
  it('account', () => {
    expect(parseAccount({ name: 'HDFC', type: 'bank', opening: '1000' }).value).toMatchObject({ opening: 1000, emoji: '🏦' });
    expect(parseAccount({ name: '', type: 'bank' }).error).toBeTruthy();
    expect(parseAccount({ name: 'x', type: 'crypto' }).error).toBeTruthy();
  });
  it('goal', () => {
    expect(parseGoal({ name: 'Laptop', target: 60000, targetDate: '2027-03-01', kind: 'emergency' }).value).toMatchObject({ kind: 'emergency', emoji: '🎯' });
    expect(parseGoal({ name: 'x', target: -1 }).error).toBeTruthy();
    expect(parseGoal({ name: 'x', target: 1, targetDate: 'soon' }).error).toBeTruthy();
  });
  it('settings', () => {
    expect(parseSettings({ savingsTarget: 25, rollover: true, emergencyMonths: 6 }).value).toEqual({ savingsTarget: 25, rollover: true, emergencyMonths: 6 });
    expect(parseSettings({ savingsTarget: 150 }).error).toBeTruthy();
    expect(parseSettings({ rollover: 'yes' }).value.rollover).toBe(false);
  });
});
