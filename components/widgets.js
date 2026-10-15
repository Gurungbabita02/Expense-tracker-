'use client';
import { AmountInput, Progress, Seg } from './ui';
import { fm } from '../lib/format';

export const TYPE_OPTIONS = [['expense', 'Expense', 'e'], ['income', 'Income', 'i'], ['saving', 'Saving', 'sv'], ['transfer', 'Transfer', 'tr']];

export const firstCat = (cats, type) => cats.find((c) => c.type === type && !c.archived)?.name || '';
export const activeAccount = (accounts) => accounts.find((a) => !a.archived)?.id || '';
export const blankTx = (app, type = 'expense') => ({
  type, amt: '', note: '', cat: firstCat(app.cats, type), goalId: '', accountId: activeAccount(app.accounts), toAccountId: '',
  ...(type === 'transfer' ? { toAccountId: app.accounts.filter((a) => !a.archived)[1]?.id || '' } : {}),
});

// Fields that depend on the transaction type; shared by the add form, the edit form and recurring rules.
export function TxFields({ app, f, setF, p = 'f' }) {
  const { cats, accounts, goals } = app;
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setType = (type) => setF((s) => ({
    ...s, type,
    cat: type === 'expense' || type === 'income' ? firstCat(cats, type) : s.cat,
    goalId: type === 'saving' ? s.goalId : '',
    toAccountId: type === 'transfer' ? accounts.find((a) => !a.archived && a.id !== s.accountId)?.id || '' : '',
  }));
  const accOpts = (current) => accounts.filter((a) => !a.archived || a.id === current).map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>);
  const catOpts = cats.filter((c) => c.type === f.type && (!c.archived || c.name === f.cat));
  const live = accounts.filter((a) => !a.archived);

  return (<>
    <Seg label="Transaction type" value={f.type} onChange={setType} options={TYPE_OPTIONS} />
    <label htmlFor={p + 'a'}>Amount</label>
    <AmountInput id={p + 'a'} value={f.amt} onChange={(v) => setF((s) => ({ ...s, amt: v }))} />
    <label htmlFor={p + 'n'}>Note</label>
    <input id={p + 'n'} maxLength={80} placeholder={f.type === 'saving' ? 'e.g. Monthly top-up' : f.type === 'transfer' ? 'e.g. Move to savings account' : 'e.g. Dinner with friends'} value={f.note} onChange={set('note')} />

    {(f.type === 'expense' || f.type === 'income') && (<>
      <label htmlFor={p + 'c'}>Category</label>
      <select id={p + 'c'} value={f.cat} onChange={set('cat')}>{catOpts.map((c) => <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>)}</select>
    </>)}
    {f.type === 'saving' && (<>
      <label htmlFor={p + 'g'}>Save towards</label>
      <select id={p + 'g'} value={f.goalId} onChange={set('goalId')}>
        <option value="">General savings (no goal)</option>
        {goals.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
      </select>
    </>)}

    <label htmlFor={p + 'ac'}>{f.type === 'transfer' ? 'From account' : f.type === 'income' ? 'Paid into' : 'Paid from'}</label>
    <select id={p + 'ac'} value={f.accountId} onChange={set('accountId')}>{accOpts(f.accountId)}</select>
    {f.type === 'transfer' && (<>
      <label htmlFor={p + 'to'}>To account</label>
      <select id={p + 'to'} value={f.toAccountId} onChange={set('toAccountId')}>
        <option value="" disabled>Choose an account</option>
        {accounts.filter((a) => (!a.archived || a.id === f.toAccountId) && a.id !== f.accountId).map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
      </select>
      {live.length < 2 && <p className="hint">You need a second account to move money. Add one in Setup.</p>}
    </>)}
  </>);
}

export function EmergencyMeter({ ef, target, go }) {
  if (!ef.hasGoal) {
    return (
      <div className="meter">
        <h2>Emergency fund</h2>
        <p className="muted" style={{ margin: '0 0 14px' }}>Aim to cover {target} months of spending. Create an emergency fund goal and we'll track how far you are.</p>
        {go && <button className="ghost" onClick={() => go('savings')}>Set up emergency fund</button>}
      </div>
    );
  }
  const covered = ef.covered;
  const pct = covered === null ? 0 : (covered / target) * 100;
  return (
    <div className="meter">
      <h2>Emergency fund</h2>
      {covered === null ? (
        <p className="muted" style={{ margin: 0 }}>{fm(ef.saved)} saved. Add some spending history and we'll show how many months it covers.</p>
      ) : (<>
        <div className="big">{covered.toFixed(1)}<small>of {target} months</small></div>
        <div style={{ margin: '12px 0 8px' }}><Progress large pct={pct} color={pct >= 100 ? 'var(--green)' : 'var(--teal)'} /></div>
        <div className="sub2">{fm(ef.saved)} saved · you spend about {fm(ef.avg)} a month{ef.partial ? ' (based on this month so far)' : ''}</div>
      </>)}
    </div>
  );
}
