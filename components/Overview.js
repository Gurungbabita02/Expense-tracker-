'use client';
import { useMemo } from 'react';
import { accountBalances, budgetRows, emergency, expenseByCat, goalPlan, insights, makeCatOf, monthStats, rateSeries, savedByGoal } from '../lib/calc';
import { fm, monthLabel, dayLabel } from '../lib/format';
import { Progress } from './ui';
import { EmergencyMeter } from './widgets';

function RateChart({ series, target, onPick, month }) {
  const W = 300, H = 130, px = 20, py = 18;
  const vals = series.map((s) => s.rate).filter((v) => v !== null);
  const lo = Math.min(0, target, ...vals), hi = Math.max(target + 10, 10, ...vals);
  const x = (i) => px + (i * (W - 2 * px)) / (series.length - 1);
  const y = (v) => H - py - ((v - lo) / (hi - lo)) * (H - 2 * py);
  let d = '', pen = false;
  series.forEach((s, i) => {
    if (s.rate === null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.rate).toFixed(1)} `; pen = true;
  });
  const summary = series.map((s) => `${monthLabel(s.month, { month: 'short' })} ${s.rate === null ? 'no income' : s.rate + '%'}`).join(', ');
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Savings rate by month. Target ${target}%. ${summary}`}>
        {lo < 0 && <line x1={px} x2={W - px} y1={y(0)} y2={y(0)} stroke="var(--line)" />}
        <line x1={px} x2={W - px} y1={y(target)} y2={y(target)} stroke="var(--teal)" strokeDasharray="4 4" strokeWidth="1.2" />
        <text x={W - px} y={y(target) - 4} textAnchor="end">target {target}%</text>
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => s.rate !== null && (
          <g key={s.month} style={{ cursor: 'pointer' }} onClick={() => onPick(s.month)}>
            <circle cx={x(i)} cy={y(s.rate)} r={s.month === month ? 4.5 : 3} fill={s.rate >= target ? 'var(--green)' : 'var(--card)'} stroke="var(--accent)" strokeWidth="2" />
            <text x={x(i)} y={y(s.rate) - 8} textAnchor="middle" style={{ fill: 'var(--ink)' }}>{s.rate}%</text>
          </g>
        ))}
        {series.map((s, i) => <text key={s.month} x={x(i)} y={H - 3} textAnchor="middle">{monthLabel(s.month, { month: 'short' })}</text>)}
      </svg>
    </div>
  );
}

export default function Overview({ app }) {
  const { tx, cats, accounts, goals, recurring, user, month, today, budget, go, setMonth } = app;
  const { savingsTarget: target, emergencyMonths, rollover } = user.settings;
  const catOf = useMemo(() => makeCatOf(cats), [cats]);

  const st = monthStats(tx, month);
  const bal = accountBalances(accounts, tx);
  const total = Object.values(bal).reduce((a, b) => a + b, 0);
  const sv = savedByGoal(tx);
  const by = expenseByCat(tx, month);
  const ents = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const series = rateSeries(tx, month);
  const mx = Math.max(1, ...series.flatMap((m) => [m.income, m.expense, m.saved]));
  const ins = insights(tx, month, today);
  const ef = emergency(goals, tx, today);
  const upcoming = recurring.filter((r) => r.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 4);
  const watch = budget && budget.month === month
    ? budgetRows(cats, tx, month, budget.limits, budget.prevLimits, rollover).filter((r) => r.eff > 0 && r.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 4) : [];
  const topGoals = goals.slice(0, 3);
  let off = 0;
  const lbl = monthLabel(month, { month: 'short' });

  return (
    <div className="grid">
      <div className="col">
        <section className="card hero">
          <small>Available balance{accounts.filter((a) => !a.archived).length > 1 ? ' across your accounts' : ''}</small>
          <div className="bal num">{fm(total)}</div>
          <div className="pills">
            <div className="pill"><span>Income · {lbl}</span><b className="up">+{fm(st.income)}</b></div>
            <div className="pill"><span>Spent · {lbl}</span><b className="dn">−{fm(st.expense)}</b></div>
            <div className="pill"><span>Set aside · {lbl}</span><b>{fm(st.saved)}</b></div>
            <div className="pill"><span>Savings rate · target {target}%</span><b className={st.rate !== null && st.rate >= target ? 'up' : ''}>{st.rate === null ? '–' : st.rate + '%'}</b></div>
          </div>
          {sv.total > 0 && <p style={{ margin: '16px 0 0', fontSize: 14, opacity: 0.85, position: 'relative', zIndex: 1 }}>Plus {fm(sv.total)} saved in your goals</p>}
        </section>

        <div className="two">
          <section className="card">
            <h2>Where your money goes</h2>
            <div className="donutbox">
              <div className="donut">
                <svg viewBox="0 0 36 36" width="150" height="150" role="img" aria-label={`Spending by category, total ${fm(st.expense)}`}>
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="var(--soft)" strokeWidth="4.5" />
                  {ents.map(([k, v]) => {
                    const p = (v / st.expense) * 100, w = Math.max(p - 1, 0.5), o = off; off += p;
                    return <circle key={k} cx="18" cy="18" r="15.9155" fill="none" stroke={catOf(k, 'expense').color} strokeWidth="4.5" strokeDasharray={`${w} ${100 - w}`} strokeDashoffset={-o} />;
                  })}
                </svg>
                <div><b>{fm(st.expense)}</b>spent</div>
              </div>
              <div className="legend">
                {ents.slice(0, 5).map(([k, v]) => <div key={k}><i style={{ background: catOf(k, 'expense').color }} />{k}<em>{Math.round((v / st.expense) * 100)}%</em></div>)}
                {!ents.length && <div className="empty">No spending in {monthLabel(month)}</div>}
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Last 6 months</h2>
            <div className="bars">
              {series.map((m) => (
                <button className={'m' + (m.month === month ? ' cur' : '')} key={m.month} onClick={() => setMonth(m.month)} aria-label={`Show ${monthLabel(m.month)}`}>
                  <div className="pair">
                    <i style={{ height: (m.income / mx) * 100 + '%', background: 'var(--green)' }} />
                    <i style={{ height: (m.expense / mx) * 100 + '%', background: 'var(--coral)' }} />
                    <i style={{ height: (m.saved / mx) * 100 + '%', background: 'var(--teal)' }} />
                  </div>
                  <span>{monthLabel(m.month, { month: 'short' })}</span>
                </button>
              ))}
            </div>
            <div className="key"><span><b style={{ background: 'var(--green)' }} />Income</span><span><b style={{ background: 'var(--coral)' }} />Spent</span><span><b style={{ background: 'var(--teal)' }} />Set aside</span></div>
          </section>
        </div>

        <div className="two">
          <section className="card">
            <h2>Savings rate</h2>
            <RateChart series={series} target={target} month={month} onPick={setMonth} />
            <p className="hint">Share of income you kept after spending. Months with no income are skipped.</p>
          </section>
          <section className="card">
            <h2>{monthLabel(month, { month: 'long' })} vs last month</h2>
            {ins.length ? (
              <ul className="ins">{ins.map((i, k) => <li key={k} className={i.tone}><i />{i.text}</li>)}</ul>
            ) : <div className="empty">Add a few weeks of transactions and comparisons will show up here.</div>}
          </section>
        </div>

        <div className="two">
          <section className="card"><EmergencyMeter ef={ef} target={emergencyMonths} go={go} /></section>
          <section className="card">
            <div className="tools"><h2>Savings goals</h2><button className="ghost" onClick={() => go('savings')}>{goals.length ? 'See all' : 'Add a goal'}</button></div>
            {topGoals.length ? topGoals.map((g) => {
              const saved = sv.by[g.id] || 0, p = goalPlan(g, saved, today);
              return (
                <div className="bud" key={g.id}>
                  <div className="r"><b>{g.emoji} {g.name}</b><span>{fm(saved)} / {fm(g.target)}</span></div>
                  <Progress pct={p.pct} color={p.done ? 'var(--green)' : 'var(--teal)'} />
                </div>
              );
            }) : <div className="empty">No goals yet. Pick something to save for.</div>}
          </section>
        </div>
      </div>

      <aside className="col">
        <section className="card">
          <div className="tools"><h2>Accounts</h2><button className="ghost" onClick={() => go('setup')}>Manage</button></div>
          {accounts.filter((a) => !a.archived).map((a) => (
            <div className="row" key={a.id}>
              <div className="ic" style={{ background: 'var(--soft)', width: 38, height: 38, fontSize: 18 }}>{a.emoji}</div>
              <div className="grow"><b>{a.name}</b></div>
              <b className="amt" style={{ color: bal[a.id] < 0 ? 'var(--coral)' : undefined }}>{fm(bal[a.id] || 0)}</b>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="tools"><h2>Coming up</h2><button className="ghost" onClick={() => go('recurring')}>Recurring</button></div>
          {upcoming.length ? upcoming.map((r) => (
            <div className="row" key={r.id}>
              <div className="grow"><b>{r.note || r.cat}</b><span>{dayLabel(r.nextDate)} · {r.frequency}</span></div>
              <b className="amt" style={{ color: r.type === 'income' ? 'var(--green)' : undefined }}>{r.type === 'income' ? '+' : ''}{fm(r.amt)}</b>
            </div>
          )) : <div className="empty">Nothing scheduled. Add rent, subscriptions or a monthly saving.</div>}
        </section>

        <section className="card">
          <div className="tools"><h2>Budget watch</h2><button className="ghost" onClick={() => go('budgets')}>Budgets</button></div>
          {watch.length ? watch.map((r) => (
            <div className="bud" key={r.cat.id}>
              <div className="r"><b>{r.cat.emoji} {r.cat.name}</b><span className={r.pct > 100 ? 'over' : ''}>{Math.round(r.pct)}% used</span></div>
              <Progress pct={r.pct} color={r.pct > 100 ? 'var(--coral)' : '#F2A93B'} />
            </div>
          )) : <div className="empty">{budget ? 'Nothing close to its limit this month.' : 'Loading…'}</div>}
        </section>
      </aside>
    </div>
  );
}
