// Browser-side fetch helper: JSON in/out, readable errors, bounce to /login when the session ends
export async function api(path, { method = 'GET', body } = {}) {
  const r = await fetch(path, {
    method, cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401) { window.location.href = '/login'; throw new Error('Your session has ended. Please log in again.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}

export const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
