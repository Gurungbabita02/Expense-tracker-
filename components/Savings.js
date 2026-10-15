'use client';
import { useState } from 'react';
import { api } from '../lib/client';
import { emergency, goalPlan, monthStats, savedByGoal } from '../lib/calc';
import { fm, dayLabel } from '../lib/format';
import { AmountInput, EmojiPick, Modal, Progress } from './ui';
import { EmergencyMeter, activeAccount } from './widgets';

function GoalModal({ app, goal, onClose }) {
  const { say, reload } = app;
  const [f, setF] = useState(() => goal
    ? { name: goal.name, emoji: goal.emoji, target: String(goal.target), targetDate: goal.targetDate || '', note: goal.note || '', kind: goal.kind }
    : { name: '', emoji: '🎯', target: '', targetDate: '', note: '', kind: 'general' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api('/api/goals' + (goal ? '/' + goal.id : ''), { method: goal ? 'PUT' : 'POST', body: { ...f, target: Number(f.target), targetDate: f.targetDate || null } });
      await reload(); say(goal ? 'Goal updated' : 'Goal created'); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Delete "${goal.name}"? The money you saved stays in your history as general savings.`)) return;
    try { await api('/api/goals/' + goal.id, { method: 'DELETE' }); await reload(); say('Goal deleted'); onClose(); } catch (e2) { setErr(e2.message); }
  }
  return (
    <Modal title={goal ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="gn">What are you saving for?</label>
        <input id="gn" required maxLength={40} placeholder="e.g. New laptop" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label>Icon</label>
        <EmojiPick value={f.emoji} onChange={(emoji) => setF({ ...f, emoji })} />
        <label htmlFor="gt">Target amount</label>
        <AmountInput id="gt" value={f.target} onChange={(target) => setF({ ...f, target })} />
        <label htmlFor="gd">Target date (optional)</label>
        <input id="gd" type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} />
        <label htmlFor="gno">Note (optional)</label>
        <input id="gno" maxLength={120} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <label className="chk" style={{ marginTop: 16, color: 'var(--ink)', fontWeight: 500 }}>
          <input type="checkbox" checked={f.kind === 'emergency'} onChange={(e) => setF({ ...f, kind: e.target.checked ? 'emergency' : 'general' })} />
          This is my emergency fund
        </label>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="btnrow">
          {goal && <button type="button" className="ghost danger" onClick={remove}>Delete</button>}
          <button className="add" disabled={busy || !f.name.trim() || !(Number(f.target) > 0)}>{goal ? 'Save goal' : 'Create goal'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AddMoneyModal({ app, goal, onClose }) {
  const { accounts, today, say, set } = app;
  const [f, setF] = useState({ amt: '', accountId: activeAccount(accounts), date: today, note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api('/api/transactions', { method: 'POST', body: { type: 'saving', goalId: goal?.id || '', amt: Number(f.amt), accountId: f.accountId, date: f.date, note: f.note } });
      set('tx', (p) => [d, ...p]); say('Added to ' + (goal?.name || 'general savings')); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  return (
    <Modal title={`Add money to ${goal ? goal.name : 'general savings'}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="am">Amount</label>
        <AmountInput id="am" value={f.amt} onChange={(amt) => setF({ ...f, amt })} />
        <label htmlFor="aa">Take it from</label>
        <select id="aa" value={f.accountId} onChange={(e) => setF({ ...f, accountId: e.target.value })}>
          {accounts.filter((a) => !a.archived).map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </select>
        <label htmlFor="ad">Date</label>
        <input id="ad" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        <label htmlFor="an2">Note (optional)</label>
        <input id="an2" maxLength={80} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        {err && <div className="err" role="alert">{err}</div>}
        <button className="add" disabled={busy || !(Number(f.amt) > 0)}>Add money</button>
      </form>
    </Modal>
  );
}

function TargetsModal({ app, onClose }) {
  const { user, say, set } = app;
  const [f, setF] = useState({ savingsTarget: String(user.settings.savingsTarget), emergencyMonths: String(user.settings.emergencyMonths) });
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      const s = await api('/api/settings', { method: 'PUT', body: { savingsTarget: Number(f.savingsTarget), emergencyMonths: Number(f.emergencyMonths) } });
      set('user', (u) => ({ ...u, settings: s })); say('Targets updated'); onClose();
    } catch (e2) { setErr(e2.message); }
  }
  return (
    <Modal title="Savings targets" onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="st">Monthly savings rate target (% of income)</label>
        <input id="st" type="number" min="0" max="90" step="1" required value={f.savingsTarget} onChange={(e) => setF({ ...f, savingsTarget: e.target.value })} />
        <label htmlFor="em">Emergency fund target (months of spending)</label>
        <input id="em" type="number" min="1" max="24" step="1" required value={f.emergencyMonths} onChange={(e) => setF({ ...f, emergencyMonths: e.target.value })} />
        <p className="hint">Most people aim for 3–6 months of spending in an emergency fund.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <button className="add">Save targets</button>
      </form>
    </Modal>
  );
}

export default function Savings({ app }) {
  const { tx, goals, user, today } = app;
  const [modal, setModal] = useState(null); // {kind:'goal'|'money'|'targets', goal?}
  const sv = savedByGoal(tx);
  const st = monthStats(tx, today.slice(0, 7)); // this tab has no month picker, so always show the current month
  const ef = emergency(goals, tx, today);
  const { savingsTarget, emergencyMonths } = user.settings;
  const recent = tx.filter((t) => t.type === 'saving').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  const gname = (id) => goals.find((g) => g.id === id)?.name || 'General savings';

  return (
    <>
      <div className="three" style={{ marginBottom: 20 }}>
        <section className="card">
          <h2>Total saved</h2>
          <div className="stat">{fm(sv.total)}</div>
          <div className="sub2">{goals.length ? `across ${goals.length} goal${goals.length > 1 ? 's' : ''}` : 'in savings'}{sv.general > 0 ? ` · ${fm(sv.general)} not assigned to a goal` : ''}</div>
        </section>
        <section className="card">
          <div className="tools"><h2>Savings rate <small>this month</small></h2><button className="ghost" onClick={() => setModal({ kind: 'targets' })}>Targets</button></div>
          <div className="stat" style={{ color: st.rate !== null && st.rate >= savingsTarget ? 'var(--green)' : undefined }}>{st.rate === null ? '–' : st.rate + '%'}</div>
          <div className="sub2">{st.rate === null ? 'No income recorded this month' : st.rate >= savingsTarget ? `On target (${savingsTarget}%)` : `Target is ${savingsTarget}%`} · {fm(st.saved)} set aside</div>
        </section>
        <section className="card"><EmergencyMeter ef={ef} target={emergencyMonths} /></section>
      </div>

      <div className="tools" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Goals</h2>
        <div className="row2">
          <button className="ghost" onClick={() => setModal({ kind: 'money', goal: null })}>Add to general savings</button>
          <button className="ghost pri" onClick={() => setModal({ kind: 'goal', goal: null })}>New goal</button>
        </div>
      </div>

      {goals.length ? (
        <div className="goals">
          {goals.map((g) => {
            const saved = sv.by[g.id] || 0, p = goalPlan(g, saved, today);
            return (
              <section className="card goal" key={g.id}>
                <div className="head">
                  <div className="ic" style={{ background: 'var(--soft)' }}>{g.emoji}</div>
                  <div><b>{g.name}</b>{g.kind === 'emergency' && <span className="chip teal">Emergency fund</span>}</div>
                </div>
                <Progress large pct={p.pct} color={p.done ? 'var(--green)' : 'var(--teal)'} />
                <div className="nums"><b>{fm(saved)}</b><span>of {fm(g.target)} · {Math.floor(p.pct)}%</span></div>
                <div className={'plan' + (p.late ? ' late' : '')}>
                  {p.done ? 'Goal reached 🎉'
                    : p.late ? `Target date passed. ${fm(p.remaining)} still to go.`
                    : p.perMonth !== null ? `Save about ${fm(p.perMonth)} a month to finish by ${dayLabel(g.targetDate, true)}`
                    : `${fm(p.remaining)} to go`}
                  {g.note ? <div style={{ marginTop: 2 }}>{g.note}</div> : null}
                </div>
                <div className="btns">
                  <button className="ghost pri" onClick={() => setModal({ kind: 'money', goal: g })}>Add money</button>
                  <button className="ghost" onClick={() => setModal({ kind: 'goal', goal: g })}>Edit</button>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="card"><div className="empty">
          No goals yet. Name something you're saving for, like an emergency fund, a trip or a new phone, and watch it fill up.
          <div><button className="ghost pri" style={{ marginTop: 14 }} onClick={() => setModal({ kind: 'goal', goal: null })}>Create your first goal</button></div>
        </div></section>
      )}

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Recent savings</h2>
        {recent.length ? recent.map((t) => (
          <div className="row" key={t.id}>
            <div className="grow"><b>{t.note || 'Savings added'}</b><span>{gname(t.goalId)} · {dayLabel(t.date, true)}{t.recurringId ? ' · 🔁 automatic' : ''}</span></div>
            <b className="amt" style={{ color: 'var(--teal)' }}>{fm(t.amt)}</b>
          </div>
        )) : <div className="empty">Nothing saved yet.</div>}
      </section>

      {modal?.kind === 'goal' && <GoalModal app={app} goal={modal.goal} onClose={() => setModal(null)} />}
      {modal?.kind === 'money' && <AddMoneyModal app={app} goal={modal.goal} onClose={() => setModal(null)} />}
      {modal?.kind === 'targets' && <TargetsModal app={app} onClose={() => setModal(null)} />}
    </>
  );
}
