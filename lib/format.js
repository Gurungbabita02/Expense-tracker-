export const fm = (n) => (n < 0 ? '−' : '') + '₹' + Math.round(Math.abs(Number(n) || 0)).toLocaleString('en-IN');
export const monthLabel = (m, opts) => new Date(m + '-01T00:00').toLocaleDateString('en-IN', opts || { month: 'long', year: 'numeric' });
export const dayLabel = (d, withYear) => new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
