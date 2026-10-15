'use client';
import { useState } from 'react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const r = await fetch('/api/auth/' + mode, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Something went wrong');
      window.location.replace('/'); // full reload so the new session cookie is used everywhere
    } catch (e2) { setErr(e2.message); setBusy(false); }
  }

  return (
    <div className="authwrap">
      <form className="card authcard" onSubmit={submit}>
        <div className="brand"><div className="logo"><i /></div>Pocketwise</div>
        <h1>{reg ? 'Create your account' : 'Welcome back'}</h1>
        <p className="sub">{reg ? 'Track income, spending and budgets in one place.' : 'Log in to see your money.'}</p>

        {reg && (<>
          <label htmlFor="nm">Name</label>
          <input id="nm" autoComplete="name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </>)}
        <label htmlFor="em">Email</label>
        <input id="em" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" required minLength={reg ? 8 : undefined} autoComplete={reg ? 'new-password' : 'current-password'}
          placeholder={reg ? 'At least 8 characters' : ''} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />

        {err && <div className="err" role="alert">{err}</div>}
        <button className="add" disabled={busy}>{busy ? 'Please wait…' : reg ? 'Sign up' : 'Log in'}</button>
        <p className="swap">
          {reg ? 'Already have an account?' : 'New to Pocketwise?'}{' '}
          <button type="button" className="link" onClick={() => { setMode(reg ? 'login' : 'register'); setErr(''); }}>{reg ? 'Log in' : 'Create an account'}</button>
        </p>
      </form>
    </div>
  );
}
