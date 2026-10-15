// Date helpers shared by server and browser. All dates are plain 'YYYY-MM-DD' strings
// (no time zone), so "today" must always come from the user's own clock (localISO).
const pad = (n) => String(n).padStart(2, '0');

export const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const ym = (d) => String(d || '').slice(0, 7);
export const isMonth = (m) => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function isISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export const shiftMonth = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
};

export const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

export const daysBetween = (a, b) => {
  const t = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
};

const dim = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export const FREQS = ['weekly', 'monthly', 'yearly'];

// The n-th occurrence (0-based) of a repeating schedule. Computed from the start date every time,
// so "31st of every month" stays on the 31st (clamped to month end) instead of drifting to the 28th.
export function occurrence(start, freq, n) {
  const [y, m, d] = start.split('-').map(Number);
  if (freq === 'weekly') return addDays(start, 7 * n);
  if (freq === 'monthly') {
    const t = m - 1 + n;
    const yy = y + Math.floor(t / 12), mm = ((t % 12) + 12) % 12;
    return `${yy}-${pad(mm + 1)}-${pad(Math.min(d, dim(yy, mm)))}`;
  }
  if (freq === 'yearly') {
    const yy = y + n;
    return `${yy}-${pad(m)}-${pad(Math.min(d, dim(yy, m - 1)))}`;
  }
  throw new Error('Unknown frequency');
}

// Index of the first occurrence strictly after `after` (or on/after `from` when `inclusive`)
export function firstIndexAfter(start, freq, after, inclusive = false) {
  for (let n = 0; n < 6000; n++) {
    const o = occurrence(start, freq, n);
    if (inclusive ? o >= after : o > after) return n;
  }
  return 6000;
}
