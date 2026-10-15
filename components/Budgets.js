'use client';
import { useState } from 'react';
import { api } from '../lib/client';
import { budgetRows, monthStats } from '../lib/calc';
import { fm, monthLabel } from '../lib/format';
import { Progress } from './ui';

export default function Budgets({ app }) {
  const { tx, cats, user, month, budget, setBudget, say, set } = app;
  const [edit, setEdit] = useState(null); // { limits: {}, cap: '' } while editing
  const [busy, setBusy] = useState(false);
  const rollover = user.settings.rollover;

  if (!budget || budget.month !== month) return <div className="card"><div className="empty">Loading budgets…</div></div>;

  const rows = budgetRows(cats, tx, month, budget.limits, budget.prevLimits, rollover);
  const spent = monthStats(tx, month).expense;
  const sumLimits = rows.reduce((s, r) => s + r.eff, 0);
  const total = budget.cap || sumLimits;
  const tp = total ? (spent / total) * 100 : 0;
  const colorFor = (p, base) => (p > 100 ? 'var(--coral)' : p > 80 ? '#F2A93B' : base);

  async function save() {
    setBusy(true);
    try {
      const d = await api('/api/budgets', { method: 'PUT', body: { month, limits: edit.limits, cap: edit.cap === '' ? null : Number(edit.cap) } });
      setBudget(d); setEdit(null); say('Budgets saved');
    } catch (e) { say(e.message); }
    setBusy(false);
  }

  async function toggleRollover(on) {
    try { const s = await api('/api/settings', { method: 'PUT', body: { rollover: on } }); set('user', (u) => ({ ...u, settings: s })); }
    catch (e) { say(e.message); }
  }

  return (
    <div className="grid">
      <div className="col">
        <section className="card">
          <div className="tools">
            <h2>{monthLabel(month)} budget</h2>
            {edit
              ? <div className="row2"><button className="ghost" onClick={() => setEdit(null)}>Cancel</button><button className="ghost pri" disabled={busy} onClick={save}>Save</button></div>
              : <button className="ghost" onClick={() => setEdit({ limits: { ...budget.limits }, cap: budget.cap ?? '' })}>Edit budgets</button>}
          </div>
          <p className="hint" style={{ margin: '0 0 18px' }}>Changes apply to {monthLabel(month)} and every month after it, until you change them again.</p>

          <div className="bud">
            <div className="r">
              <b>Overall spending</b>
              {edit
                ? <span><input className="budin" type="number" min="0" aria-label="Overall monthly cap" placeholder="No cap" value={edit.cap} onChange={(e) => setEdit({ ...edit, cap: e.target.value })} /></span>
                : <span className={tp > 100 ? 'over' : ''}>{fm(spent)} / {total ? fm(total) : 'no limit'}{!budget.cap && total ? ' (sum of categories)' : ''}</span>}
            </div>
            <Progress large pct={tp} color={colorFor(tp, 'var(--hero2)')} />
            {edit && <p className="hint">Optional overall cap. Leave empty to use the total of your category budgets.</p>}
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />

          {rows.map((r) => (
            <div className="bud" key={r.cat.id}>
              <div className="r">
                <b>{r.cat.emoji} {r.cat.name}</b>
                {edit
                  ? <input className="budin" type="number" min="0" aria-label={r.cat.name + ' budget'} value={edit.limits[r.cat.name] ?? ''} onChange={(e) => setEdit({ ...edit, limits: { ...edit.limits, [r.cat.name]: e.target.value } })} />
                  : <span className={r.pct > 100 ? 'over' : ''}>{fm(r.spent)} / {r.eff ? fm(r.eff) : 'no limit'}</span>}
              </div>
              <Progress pct={r.pct} color={colorFor(r.pct, r.cat.color)} />
              {!edit && r.carry > 0 && <div className="carry">Includes {fm(r.carry)} carried over from last month</div>}
              {!edit && r.eff > 0 && r.spent > r.eff && <div className="carry over">{fm(r.spent - r.eff)} over budget</div>}
            </div>
          ))}
          {!rows.length && <div className="empty">No expense categories yet. Add some in Setup.</div>}
        </section>
      </div>

      <aside className="col">
        <section className="card">
          <h2>Carry over unspent budget</h2>
          <label className="chk wrap" style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
            <input type="checkbox" checked={rollover} onChange={(e) => toggleRollover(e.target.checked)} />
            Add last month's unspent amount to this month
          </label>
          <p className="hint">Only the previous month is carried, and only what you left unspent. Going over never reduces next month's budget.</p>
        </section>
      </aside>
    </div>
  );
}
