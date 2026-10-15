'use client';
import { useMemo, useRef, useState } from 'react';
import { api, csvCell } from '../lib/client';
import { makeCatOf } from '../lib/calc';
import { ym } from '../lib/dates';
import { fm, dayLabel } from '../lib/format';
import { TxFields, blankTx } from './widgets';

const FILTERS = [['all', 'All'], ['expense', 'Spent'], ['income', 'Income'], ['saving', 'Saved'], ['transfer', 'Transfers']];

export default function Transactions({ app }) {
  const { tx, cats, accounts, goals, month, today, say, set, setMonth } = app;
  const [filter, setFilter] = useState('all');
  const [acc, setAcc] = useState('all');
  const [search, setSearch] = useState('');
  const [allTime, setAllTime] = useState(false);
  const [f, setF] = useState(() => ({ ...blankTx(app), date: today }));
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);
  const catOf = useMemo(() => makeCatOf(cats), [cats]);
  const accName = (id) => { const a = accounts.find((x) => x.id === id); return a ? a.name : 'Account'; };
  const goalName = (id) => goals.find((g) => g.id === id)?.name;

  const q = search.trim().toLowerCase();
  const list = tx
    .filter((t) => (allTime || ym(t.date) === month) && (filter === 'all' || t.type === filter))
    .filter((t) => acc === 'all' || t.accountId === acc || t.toAccountId === acc)
    .filter((t) => !q || (t.note || '').toLowerCase().includes(q) || t.cat.toLowerCase().includes(q) || (goalName(t.goalId) || '').toLowerCase().includes(q))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const reset = () => { setEditId(null); setF({ ...blankTx(app), date: today }); };

  function startEdit(t) {
    setEditId(t.id);
    setF({ type: t.type, amt: String(t.amt), note: t.note || '', cat: t.cat, goalId: t.goalId || '', accountId: t.accountId || '', toAccountId: t.toAccountId || '', date: t.date });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function save() {
    if (!(parseFloat(f.amt) > 0)) return say('Enter an amount above 0');
    setBusy(true);
    try {
      const d = await api('/api/transactions' + (editId ? '/' + editId : ''), { method: editId ? 'PUT' : 'POST', body: { ...f, amt: parseFloat(f.amt) } });
      set('tx', (p) => (editId ? p.map((t) => (t.id === editId ? d : t)) : [d, ...p]));
      say(editId ? 'Changes saved' : { expense: 'Expense added', income: 'Income added', saving: 'Saving added', transfer: 'Transfer added' }[d.type]);
      if (!editId && !allTime && ym(d.date) !== month) setMonth(ym(d.date));
      reset();
    } catch (e) { say(e.message); }
    setBusy(false);
  }

  async function del(id) {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api('/api/transactions/' + id, { method: 'DELETE' });
      set('tx', (p) => p.filter((t) => t.id !== id));
      if (editId === id) reset();
      say('Deleted');
    } catch (e) { say(e.message); }
  }

  async function loadSample() {
    try { await api('/api/transactions/sample', { method: 'POST', body: { today } }); await app.reload(); say('Sample data added'); } catch (e) { say(e.message); }
  }

  function exportCsv() {
    const rows = [['Date', 'Type', 'Category', 'Note', 'Account', 'To account', 'Goal', 'Amount'],
      ...list.map((t) => [t.date, t.type, t.cat, t.note, accName(t.accountId), t.toAccountId ? accName(t.toAccountId) : '', goalName(t.goalId) || '', t.amt])];
    const blob = new Blob(['\ufeff' + rows.map((r) => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pocketwise-${allTime ? 'all-time' : month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const row = (t) => {
    const c = catOf(t.cat, t.type);
    let title = t.note || t.cat, sub, sign = '', color;
    if (t.type === 'income') { sign = '+'; color = 'var(--green)'; sub = `${t.cat} · ${accName(t.accountId)}`; }
    else if (t.type === 'expense') { sign = '−'; sub = `${t.cat} · ${accName(t.accountId)}`; }
    else if (t.type === 'saving') { color = 'var(--teal)'; title = t.note || goalName(t.goalId) || 'Savings'; sub = `Saved for ${goalName(t.goalId) || 'general savings'} · ${accName(t.accountId)}`; }
    else { color = 'var(--mute)'; title = t.note || 'Transfer'; sub = `${accName(t.accountId)} → ${accName(t.toAccountId)}`; }
    return (
      <div className={'tx' + (t.id === editId ? ' editing' : '')} key={t.id}>
        <div className="ic" style={{ background: c.color + '22' }}>{c.emoji}</div>
        <div className="t"><b>{title}</b><span>{sub} · {dayLabel(t.date, allTime)}{t.recurringId ? ' · 🔁' : ''}</span></div>
        <div className="amt" style={{ color: color || 'var(--ink)' }}>{sign}{fm(t.amt)}</div>
        <button className="x" aria-label="Edit" onClick={() => startEdit(t)}>✎</button>
        <button className="x" aria-label="Delete" onClick={() => del(t.id)}>×</button>
      </div>
    );
  };

  return (
    <div className="grid">
      <div className="col">
        <section className="card">
          <div className="tools">
            <h2>Transactions</h2>
            <div className="tabs" role="group" aria-label="Filter by type">
              {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
          </div>
          <div className="toolbar">
            <input type="search" aria-label="Search transactions" placeholder="Search note, category or goal…" value={search} onChange={(e) => setSearch(e.target.value)} />
            {accounts.length > 1 && (
              <select aria-label="Filter by account" value={acc} onChange={(e) => setAcc(e.target.value)} style={{ width: 'auto', padding: '9px 12px' }}>
                <option value="all">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}
              </select>
            )}
            <label className="chk"><input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} />All time</label>
            <button className="ghost" onClick={exportCsv} disabled={!list.length}>Export CSV</button>
          </div>
          {list.length ? list.map(row) : (
            <div className="empty">
              {tx.length ? 'No matching transactions.' : 'Nothing here yet. Add your first transaction.'}
              {!tx.length && <div><button className="ghost" style={{ marginTop: 12 }} onClick={loadSample}>Load sample data</button></div>}
            </div>
          )}
        </section>
      </div>

      <aside className="col">
        <section className="card" ref={formRef}>
          <h2>{editId ? 'Edit transaction' : 'Add transaction'}</h2>
          <TxFields app={app} f={f} setF={setF} />
          <label htmlFor="fd">Date</label>
          <input id="fd" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          <button className="add" disabled={busy} onClick={save}>{editId ? 'Save changes' : `Add ${f.type}`}</button>
          {editId && <button className="ghost full" onClick={reset}>Cancel</button>}
        </section>
      </aside>
    </div>
  );
}
