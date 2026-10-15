'use client';
import { useState } from 'react';
import { api } from '../lib/client';
import { accountBalances } from '../lib/calc';
import { ACCOUNT_TYPES } from '../lib/categories';
import { fm } from '../lib/format';
import { AmountInput, ColorPick, EmojiPick, Modal, Seg } from './ui';

function AccountModal({ app, account, onClose }) {
  const { say, reload } = app;
  const [f, setF] = useState(() => account
    ? { name: account.name, type: account.type, opening: String(account.opening) }
    : { name: '', type: 'bank', opening: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await api('/api/accounts' + (account ? '/' + account.id : ''), { method: account ? 'PUT' : 'POST', body: { ...f, opening: f.opening === '' ? 0 : Number(f.opening), emoji: ACCOUNT_TYPES[f.type] } });
      await reload(); say(account ? 'Account updated' : 'Account added'); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Remove "${account.name}"? If it has transactions it will be archived instead of deleted.`)) return;
    try { const r = await api('/api/accounts/' + account.id, { method: 'DELETE' }); await reload(); say(r.archived ? 'Account archived' : 'Account removed'); onClose(); } catch (e2) { setErr(e2.message); }
  }
  return (
    <Modal title={account ? 'Edit account' : 'New account'} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor="acn">Name</label>
        <input id="acn" required maxLength={30} placeholder="e.g. HDFC savings" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label htmlFor="act">Type</label>
        <select id="act" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {Object.entries(ACCOUNT_TYPES).map(([k, e]) => <option key={k} value={k}>{e} {k === 'card' ? 'Credit card' : k[0].toUpperCase() + k.slice(1)}</option>)}
        </select>
        <label htmlFor="aco">Balance when you started tracking</label>
        <AmountInput id="aco" allowNegative value={f.opening} onChange={(opening) => setF({ ...f, opening })} />
        <p className="hint">Use a negative number for money you owe, like a credit card balance.</p>
        {err && <div className="err" role="alert">{err}</div>}
        <div className="btnrow">
          {account && <button type="button" className="ghost danger" onClick={remove}>Remove</button>}
          <button className="add" disabled={busy || !f.name.trim()}>{account ? 'Save account' : 'Add account'}</button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryModal({ app, cat, onClose }) {
  const { say, reload } = app;
  const [f, setF] = useState(() => cat
    ? { type: cat.type, name: cat.name, emoji: cat.emoji, color: cat.color, budget: String(cat.budget || 0) }
    : { type: 'expense', name: '', emoji: '🏠', color: '#2E86DE', budget: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const body = { name: f.name, emoji: f.emoji, color: f.color, ...(f.type === 'expense' ? { budget: f.budget === '' ? 0 : Number(f.budget) } : {}) };
      await api('/api/categories' + (cat ? '/' + cat.id : ''), { method: cat ? 'PUT' : 'POST', body: cat ? body : { ...body, type: f.type } });
      await reload(); say(cat ? 'Category updated' : 'Category added'); onClose();
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Remove "${cat.name}"? If it has transactions it will be archived and hidden instead.`)) return;
    try { const r = await api('/api/categories/' + cat.id, { method: 'DELETE' }); await reload(); say(r.archived ? 'Category archived' : 'Category removed'); onClose(); } catch (e2) { setErr(e2.message); }
  }
  return (
    <Modal title={cat ? 'Edit category' : 'New category'} onClose={onClose}>
      <form onSubmit={submit}>
        {!cat && <><label>Type</label><Seg label="Category type" value={f.type} onChange={(type) => setF({ ...f, type })} options={[['expense', 'Expense', 'e'], ['income', 'Income', 'i']]} /></>}
        <label htmlFor="cn">Name</label>
        <input id="cn" required maxLength={24} placeholder="e.g. Pets" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label>Icon</label>
        <EmojiPick value={f.emoji} onChange={(emoji) => setF({ ...f, emoji })} />
        <label>Colour</label>
        <ColorPick value={f.color} onChange={(color) => setF({ ...f, color })} />
        {f.type === 'expense' && (<>
          <label htmlFor="cb">Default monthly budget (optional)</label>
          <AmountInput id="cb" value={f.budget} onChange={(budget) => setF({ ...f, budget })} />
        </>)}
        {err && <div className="err" role="alert">{err}</div>}
        <div className="btnrow">
          {cat && <button type="button" className="ghost danger" onClick={remove}>Remove</button>}
          <button className="add" disabled={busy || !f.name.trim()}>{cat ? 'Save category' : 'Add category'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Setup({ app }) {
  const { cats, accounts, tx, theme, setTheme, say, reload } = app;
  const [modal, setModal] = useState(null); // {kind:'account'|'cat', item?}
  const bal = accountBalances(accounts, tx);

  async function restore(kind, item) {
    try { await api(`/api/${kind === 'account' ? 'accounts' : 'categories'}/${item.id}`, { method: 'PUT', body: { archived: false } }); await reload(); say('Restored'); }
    catch (e) { say(e.message); }
  }

  const catList = (type, title) => {
    const live = cats.filter((c) => c.type === type && !c.archived);
    return (
      <div style={{ marginTop: 6 }}>
        <label style={{ marginTop: 10 }}>{title}</label>
        {live.map((c) => (
          <div className="row" key={c.id}>
            <div className="ic" style={{ background: c.color + '22', width: 38, height: 38, fontSize: 18 }}>{c.emoji}</div>
            <div className="grow"><b>{c.name}</b>{type === 'expense' && <span>{c.budget ? `Default budget ${fm(c.budget)}` : 'No default budget'}</span>}</div>
            <button className="ghost" onClick={() => setModal({ kind: 'cat', item: c })}>Edit</button>
          </div>
        ))}
        {!live.length && <div className="hint">None yet.</div>}
      </div>
    );
  };
  const archivedCats = cats.filter((c) => c.archived), archivedAccs = accounts.filter((a) => a.archived);

  return (
    <div className="grid">
      <div className="col">
        <section className="card">
          <div className="tools"><h2>Accounts</h2><button className="ghost pri" onClick={() => setModal({ kind: 'account' })}>Add account</button></div>
          <p className="hint" style={{ margin: '0 0 6px' }}>Track each place your money lives: bank, cash, wallet, credit card.</p>
          {accounts.filter((a) => !a.archived).map((a) => (
            <div className="row" key={a.id}>
              <div className="ic" style={{ background: 'var(--soft)', width: 38, height: 38, fontSize: 18 }}>{a.emoji}</div>
              <div className="grow"><b>{a.name}</b><span>{a.type === 'card' ? 'Credit card' : a.type[0].toUpperCase() + a.type.slice(1)}</span></div>
              <b className="amt" style={{ color: bal[a.id] < 0 ? 'var(--coral)' : undefined }}>{fm(bal[a.id] || 0)}</b>
              <button className="ghost" onClick={() => setModal({ kind: 'account', item: a })}>Edit</button>
            </div>
          ))}
          {archivedAccs.length > 0 && (<>
            <label style={{ marginTop: 18 }}>Archived</label>
            {archivedAccs.map((a) => (
              <div className="row" key={a.id}><div className="grow"><b>{a.emoji} {a.name}</b><span>{fm(bal[a.id] || 0)}</span></div><button className="ghost" onClick={() => restore('account', a)}>Restore</button></div>
            ))}
          </>)}
        </section>

        <section className="card">
          <div className="tools"><h2>Categories</h2><button className="ghost pri" onClick={() => setModal({ kind: 'cat' })}>Add category</button></div>
          {catList('expense', 'Spending')}
          {catList('income', 'Income')}
          {archivedCats.length > 0 && (<>
            <label style={{ marginTop: 18 }}>Archived</label>
            {archivedCats.map((c) => (
              <div className="row" key={c.id}><div className="grow"><b>{c.emoji} {c.name}</b><span>{c.type}</span></div><button className="ghost" onClick={() => restore('cat', c)}>Restore</button></div>
            ))}
          </>)}
        </section>
      </div>

      <aside className="col">
        <section className="card">
          <h2>Appearance</h2>
          <Seg label="Theme" value={theme} onChange={setTheme} options={[['system', 'Match device', 'pl'], ['light', 'Light', 'pl'], ['dark', 'Dark', 'pl']]} />
        </section>
      </aside>

      {modal?.kind === 'account' && <AccountModal app={app} account={modal.item} onClose={() => setModal(null)} />}
      {modal?.kind === 'cat' && <CategoryModal app={app} cat={modal.item} onClose={() => setModal(null)} />}
    </div>
  );
}
