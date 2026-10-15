'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/client';
import { localISO, shiftMonth } from '../lib/dates';
import { monthLabel } from '../lib/format';
import { useTheme } from '../components/ui';
import Overview from '../components/Overview';
import Transactions from '../components/Transactions';
import Budgets from '../components/Budgets';
import Savings from '../components/Savings';
import Recurring from '../components/Recurring';
import Setup from '../components/Setup';
import AccountSettings from '../components/AccountSettings';

const ICON = {
  system: <path d="M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18" />,
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  dark: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
};
const ThemeIcon = ({ t }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[t]}</svg>;

const TABS = [['overview', 'Overview'], ['transactions', 'Transactions'], ['budgets', 'Budgets'], ['savings', 'Savings'], ['recurring', 'Recurring'], ['setup', 'Setup']];
const MONTH_TABS = ['overview', 'transactions', 'budgets'];

export default function Home() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [month, setMonth] = useState(() => localISO().slice(0, 7));
  const [budget, setBudget] = useState(null);
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [acct, setAcct] = useState(false);
  const [theme, setTheme] = useTheme();
  const today = localISO();

  const say = useCallback((m) => { setToast(m); setTimeout(() => setToast(''), 2600); }, []);
  const set = useCallback((k, v) => setData((d) => ({ ...d, [k]: typeof v === 'function' ? v(d[k]) : v })), []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  const load = useCallback(async () => {
    setLoadError('');
    try {
      // create any recurring transactions that have come due, then fetch everything
      await api('/api/recurring/run', { method: 'POST', body: { today: localISO() } }).catch(() => {});
      const [user, tx, cats, accounts, goals, recurring] = await Promise.all(
        ['/api/auth/me', '/api/transactions', '/api/categories', '/api/accounts', '/api/goals', '/api/recurring'].map((p) => api(p)),
      );
      setData({ user, tx, cats, accounts, goals, recurring });
    } catch (e) { setLoadError(e.message || 'Could not load your data'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (TABS.some(([k]) => k === h)) setTab(h);
  }, []);

  // budgets are per month; reload when the month or the category list changes
  const cats = data?.cats;
  useEffect(() => {
    if (!cats) return;
    let live = true;
    api('/api/budgets?month=' + month).then((b) => live && setBudget(b)).catch(() => {});
    return () => { live = false; };
  }, [month, cats]);

  const go = (t) => { setTab(t); window.history.replaceState(null, '', '#' + t); window.scrollTo?.(0, 0); };

  if (!data) {
    return (
      <div className="wrap">
        {loadError ? (
          <div className="card errcard">
            <span><b>Couldn’t load your data.</b> {loadError}. Check that MongoDB is running and MONGODB_URI is set in .env.local.</span>
            <button className="add" style={{ width: 'auto', margin: 0, padding: '10px 20px' }} onClick={load}>Retry</button>
          </div>
        ) : <div className="empty">Loading your money…</div>}
      </div>
    );
  }

  const app = { ...data, month, setMonth, today, budget, setBudget, say, set, reload: load, go, theme, setTheme };
  const isNow = month === today.slice(0, 7);
  const Body = { overview: Overview, transactions: Transactions, budgets: Budgets, savings: Savings, recurring: Recurring, setup: Setup }[tab];

  return (
    <div className="wrap">
      <header>
        <div className="brand"><div className="logo"><i /></div>Pocketwise</div>
        <div className="me">
          {MONTH_TABS.includes(tab) && (
            <div className="monthnav">
              <button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
              <span>{monthLabel(month)}</span>
              <button aria-label="Next month" disabled={isNow} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
            </div>
          )}
          <button className="themebtn" aria-label={`Theme: ${{ system: 'match device', light: 'light', dark: 'dark' }[theme]}. Click to change`} title="Change theme"
            onClick={() => setTheme({ system: 'light', light: 'dark', dark: 'system' }[theme])}><ThemeIcon t={theme} /></button>
          <div className="menuwrap">
            <button className="av" aria-label="Account menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>{(data.user?.name || '?')[0].toUpperCase()}</button>
            {menu && (
              <div className="menu" onMouseLeave={() => setMenu(false)}>
                <div className="who"><b>{data.user?.name}</b><span>{data.user?.email}</span></div>
                <button onClick={() => { setAcct(true); setMenu(false); }}>Account settings</button>
                <button onClick={logout}>Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="Sections">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>{l}</button>)}
      </nav>

      <Body app={app} />

      {acct && <AccountSettings user={data.user} onClose={() => setAcct(false)} onUser={(fn) => set('user', fn)} say={say} />}
      <div className={'toast' + (toast ? ' show' : '')} role="status">{toast}</div>
    </div>
  );
}
