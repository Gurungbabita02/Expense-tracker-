import { CATEGORY_NAME_RE, RESERVED, ACCOUNT_TYPES } from './categories';
import { FREQS, isISODate } from './dates';

export const TYPES = ['expense', 'income', 'saving', 'transfer'];
export const MAX_AMOUNT = 1e9;

export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const money = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
const colorOk = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const emojiOk = (e) => typeof e === 'string' && e.length > 0 && e.length <= 12;

// ctx = { cats: Map('name|type' -> category), accounts: Map(id -> account), goals: Map(id -> goal), defaultAccountId }
// Returns { error } or { value } for a transaction payload (POST, PUT and recurring rules share this).
export function parseTransaction(b, ctx) {
  b = b || {};
  const amt = money(b.amt);
  if (!(amt > 0)) return { error: 'Amount must be greater than 0' };
  if (amt > MAX_AMOUNT) return { error: 'Amount is too large' };
  if (!TYPES.includes(b.type)) return { error: 'Type must be expense, income, saving or transfer' };

  let date;
  if (b.date === undefined || b.date === null || b.date === '') date = new Date().toISOString().slice(0, 10);
  else if (isISODate(b.date)) date = b.date;
  else return { error: 'Enter a valid date' };

  const accountId = String(b.accountId || ctx.defaultAccountId || '');
  if (!ctx.accounts.has(accountId)) return { error: 'Choose a valid account' };

  const value = { type: b.type, amt, date, accountId, note: text(b.note, 80) };

  if (b.type === 'expense' || b.type === 'income') {
    const c = ctx.cats.get(b.cat + '|' + b.type);
    if (!c || c.type !== b.type) return { error: 'Category does not match type' };
    value.cat = c.name;
  } else if (b.type === 'saving') {
    value.cat = 'Savings';
    if (b.goalId) {
      if (!ctx.goals.has(String(b.goalId))) return { error: 'Choose a valid goal' };
      value.goalId = String(b.goalId);
    }
  } else {
    value.cat = 'Transfer';
    const to = String(b.toAccountId || '');
    if (!ctx.accounts.has(to)) return { error: 'Choose the account to transfer to' };
    if (to === accountId) return { error: 'Choose two different accounts' };
    value.toAccountId = to;
  }
  return { value };
}

export function parseRecurring(b, ctx) {
  b = b || {};
  if (!isISODate(b.startDate)) return { error: 'Choose a start date' };
  const r = parseTransaction({ ...b, date: b.startDate }, ctx);
  if (r.error) return r;
  if (!FREQS.includes(b.frequency)) return { error: 'Frequency must be weekly, monthly or yearly' };
  let endDate = null;
  if (b.endDate) {
    if (!isISODate(b.endDate)) return { error: 'Enter a valid end date' };
    if (b.endDate < b.startDate) return { error: 'End date must be after the start date' };
    endDate = b.endDate;
  }
  const { date, ...rest } = r.value;
  return { value: { ...rest, frequency: b.frequency, startDate: b.startDate, endDate, active: b.active !== false } };
}

export function parseCategory(b, { partial = false } = {}) {
  b = b || {};
  const v = {};
  if (!partial || b.name !== undefined) {
    const name = String(b.name ?? '').trim(); // not sliced: too-long names are rejected, not silently cut
    if (!CATEGORY_NAME_RE.test(name)) return { error: 'Name can use letters, numbers, spaces and & \' - / ( ) (max 24)' };
    if (RESERVED.includes(name.toLowerCase())) return { error: `"${name}" is reserved` };
    v.name = name; v.key = name.toLowerCase();
  }
  if (!partial) {
    if (!['expense', 'income'].includes(b.type)) return { error: 'Type must be expense or income' };
    v.type = b.type;
  }
  if (!partial || b.emoji !== undefined) { if (!emojiOk(b.emoji)) return { error: 'Pick an emoji' }; v.emoji = b.emoji; }
  if (!partial || b.color !== undefined) { if (!colorOk(b.color)) return { error: 'Pick a colour' }; v.color = b.color; }
  if (b.budget !== undefined) {
    const n = money(b.budget);
    if (!(n >= 0) || n > MAX_AMOUNT) return { error: 'Budget must be 0 or more' };
    v.budget = Math.round(n);
  } else if (!partial) v.budget = 0;
  return { value: v };
}

export function parseAccount(b) {
  b = b || {};
  const name = text(b.name, 30);
  if (!name) return { error: 'Enter an account name' };
  if (!ACCOUNT_TYPES[b.type]) return { error: 'Choose an account type' };
  const opening = b.opening === undefined || b.opening === '' ? 0 : money(b.opening);
  if (!Number.isFinite(opening) || Math.abs(opening) > MAX_AMOUNT) return { error: 'Opening balance is not valid' };
  return { value: { name, type: b.type, emoji: emojiOk(b.emoji) ? b.emoji : ACCOUNT_TYPES[b.type], opening } };
}

export function parseGoal(b) {
  b = b || {};
  const name = text(b.name, 40);
  if (!name) return { error: 'Enter a goal name' };
  const target = money(b.target);
  if (!(target > 0) || target > 1e10) return { error: 'Target must be greater than 0' };
  let targetDate = null;
  if (b.targetDate) { if (!isISODate(b.targetDate)) return { error: 'Enter a valid target date' }; targetDate = b.targetDate; }
  return {
    value: {
      name, target, targetDate, note: text(b.note, 120),
      emoji: emojiOk(b.emoji) ? b.emoji : '🎯',
      kind: b.kind === 'emergency' ? 'emergency' : 'general',
    },
  };
}

export function parseSettings(b) {
  b = b || {};
  const v = {};
  if (b.savingsTarget !== undefined) {
    const n = Number(b.savingsTarget);
    if (!Number.isInteger(n) || n < 0 || n > 90) return { error: 'Savings target must be a whole number from 0 to 90' };
    v.savingsTarget = n;
  }
  if (b.rollover !== undefined) v.rollover = b.rollover === true;
  if (b.emergencyMonths !== undefined) {
    const n = Number(b.emergencyMonths);
    if (!Number.isInteger(n) || n < 1 || n > 24) return { error: 'Emergency fund target must be 1 to 24 months' };
    v.emergencyMonths = n;
  }
  return { value: v };
}
