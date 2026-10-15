'use client';
import { useState } from 'react';
import { api } from '../lib/client';
import { Modal } from './ui';

export default function AccountSettings({ user, onClose, onUser, say }) {
  const [name, setName] = useState(user?.name || '');
  const [pw, setPw] = useState({ cur: '', next: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function patch(body, okMsg) {
    setErr(''); setBusy(true);
    try {
      const d = await api('/api/auth/me', { method: 'PATCH', body });
      onUser((u) => ({ ...u, ...d })); say(okMsg);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  }

  return (
    <Modal title="Account settings" onClose={onClose}>
      <label htmlFor="an">Name</label>
      <input id="an" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="ghost full" disabled={busy || !name.trim() || name.trim() === user?.name} onClick={() => patch({ name }, 'Name updated')}>Update name</button>
      <label htmlFor="cp">Current password</label>
      <input id="cp" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
      <label htmlFor="np">New password</label>
      <input id="np" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
      {err && <div className="err" role="alert">{err}</div>}
      <button className="add" disabled={busy || !pw.cur || pw.next.length < 8}
        onClick={async () => { if (await patch({ currentPassword: pw.cur, newPassword: pw.next }, 'Password changed')) setPw({ cur: '', next: '' }); }}>Change password</button>
    </Modal>
  );
}
