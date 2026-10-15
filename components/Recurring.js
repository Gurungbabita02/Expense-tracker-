'use client';
import { useMemo, useState } from 'react';
import { api } from '../lib/client';
import { makeCatOf } from '../lib/calc';
import { fm, dayLabel } from '../lib/format';
import { Modal } from './ui';
import { TxFields, blankTx } from './widgets';

const FREQ = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' };

function RuleModal({ app, rule, onClose }) {
  const { today, say, reload } = app;
  const [f, setF] = useState(() => rule
    ? { type: rule.type, amt: String(rule.amt), note: rule.note || '', cat: rule.cat, goalId: rule.goalId || '', accountId: rule.accountId, toAccountId: rule.toAccountId || '', frequency: rule.frequency, startDate: rule.startDate, endDate: rule.endDate || '' }
    : { ...blankTx(app), frequency: 'monthly', startDate: today, endDate: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api('/api/recurring' + (rule ? '/' + rule.id : ''), { method: rule ? 'PUT' : 'POST', body: { ...f, amt: Number(f.amt), endDate: f.endDate || null, active: rule ? rule.active : true } });
      await api('/api/recurring/run', { method: 'POST', body: { today } }); // add anything already due
      await reload(); say(rule ? 'Rule updated' : 'Recurring rule added'); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm('Delete this rule? Transactions it already created are kept.')) return;
    try { await api('/api/recurring/' + rule.id, { method: 'DELETE' }); await reload(); say('Rule deleted'); onClose(); } catch (e2) { setErr(e2.message); }
  }

  return (
    <Modal title={rule ? 'Edit recurring rule' : 'New recurring rule'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <TxFields app={app} f={f} setF={setF} p="r" />
        <div className="field2">
          <div>
            <label htmlFor="rf">Repeats</label>
            <select id="rf" value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })}>{Object.entries(FREQ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          <div>
            <label htmlFor="rs">Starts on</label>
            <input id="rs" type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
          </div>
        </div>
        <label htmlFor="re">Ends on (optional)</label>
        <input id="re" type="date" value={f.endDate} min={f.startDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        {f.startDate && f.startDate < today && <p className="hint">This start date is in the past, so earlier occurrences will be added to your history right away.</p>}
        {f.frequency === 'monthly' && Number(f.startDate.slice(8)) > 28 && <p className="hint">In shorter months this will land on the last day of the month.</p>}
        {err && <div className="err" role="alert">{err}</div>}
        <div className="btnrow">
          {rule && <button type="button" className="ghost danger" onClick={remove}>Delete</button>}
          <button className="add" disabled={busy || !(Number(f.amt) > 0)}>{rule ? 'Save rule' : 'Add rule'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Recurring({ app }) {
  const { recurring, cats, accounts, goals, today, say, reload } = app;
  const [modal, setModal] = useState(null); // null | { rule: null | rule }
  const catOf = useMemo(() => makeCatOf(cats), [cats]);
  const acc = (id) => accounts.find((a) => a.id === id)?.name || 'Account';
  const active = recurring.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const paused = recurring.filter((r) => !r.active);

  async function toggle(r) {
    try { await api('/api/recurring/' + r.id, { method: 'PATCH', body: { active: !r.active, today } }); await reload(); say(r.active ? 'Paused' : 'Resumed'); }
    catch (e) { say(e.message); }
  }

  const row = (r) => {
    const c = catOf(r.cat, r.type);
    const sub = r.type === 'transfer' ? `${acc(r.accountId)} → ${acc(r.toAccountId)}` : r.type === 'saving' ? `Saving for ${goals.find((g) => g.id === r.goalId)?.name || 'general savings'}` : `${r.cat} · ${acc(r.accountId)}`;
    const ended = r.endDate && r.nextDate > r.endDate;
    return (
      <div className="row" key={r.id}>
        <div className="ic" style={{ background: c.color + '22', width: 40, height: 40 }}>{c.emoji}</div>
        <div className="grow">
          <b>{r.note || r.cat}</b>
          <span>{sub} · {FREQ[r.frequency].toLowerCase()}{r.active && !ended ? ` · next ${dayLabel(r.nextDate, true)}` : ''}{r.endDate ? ` · until ${dayLabel(r.endDate, true)}` : ''}</span>
        </div>
        {!r.active && <span className="chip warn">{ended ? 'Finished' : 'Paused'}</span>}
        <b className="amt" style={{ color: r.type === 'income' ? 'var(--green)' : r.type === 'saving' ? 'var(--teal)' : undefined }}>{r.type === 'income' ? '+' : ''}{fm(r.amt)}</b>
        {!(r.endDate && r.nextDate > r.endDate) && <button className="ghost" onClick={() => toggle(r)}>{r.active ? 'Pause' : 'Resume'}</button>}
        <button className="ghost" onClick={() => setModal({ rule: r })}>Edit</button>
      </div>
    );
  };

  return (
    <div className="col">
      <section className="card">
        <div className="tools">
          <h2>Recurring transactions</h2>
          <button className="ghost pri" onClick={() => setModal({ rule: null })}>New rule</button>
        </div>
        <p className="hint" style={{ margin: '0 0 8px' }}>Rent, subscriptions, salary or a monthly saving. They're added to your transactions automatically on their due date, whenever you open Pocketwise.</p>
        {active.length ? active.map(row) : (
          <div className="empty">No recurring rules yet.<div><button className="ghost" style={{ marginTop: 12 }} onClick={() => setModal({ rule: null })}>Add your first rule</button></div></div>
        )}
      </section>
      {paused.length > 0 && <section className="card"><h2>Paused and finished</h2>{paused.map(row)}</section>}
      {modal && <RuleModal app={app} rule={modal.rule} onClose={() => setModal(null)} />}
    </div>
  );
}
