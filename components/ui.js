'use client';
import { useEffect, useRef, useState } from 'react';

export const EMOJIS = ['🍜', '🚕', '🛍️', '💡', '🎬', '💊', '🏠', '📚', '🐶', '✈️', '🎁', '☕', '🏋️', '📱', '💼', '💻', '🎯', '🛟', '🚗', '🎓', '💍', '🏖️'];
export const COLORS = ['#F0604D', '#F2A93B', '#8E6CEF', '#2E86DE', '#E455A0', '#1E9E6A', '#12B5A6', '#8A9A94', '#C28A00', '#6C7AE0'];

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector('input:not([type=checkbox]),select')?.focus();
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); prev?.focus?.(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'card dlg' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="tools"><h2>{title}</h2><button className="x" aria-label="Close" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

// options: [[value, label, className?]]
export function Seg({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l, c]) => (
        <button type="button" key={k} aria-pressed={value === k} className={value === k ? 'on ' + (c || '') : ''} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

export const Progress = ({ pct, color, large }) => (
  <div className={'track' + (large ? ' lg' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, pct))}>
    <i style={{ width: Math.min(100, Math.max(0, pct)) + '%', background: color }} />
  </div>
);

export function AmountInput({ id, value, onChange, allowNegative }) {
  return (
    <div className="amtin"><span>₹</span>
      <input id={id} type="number" min={allowNegative ? undefined : '0'} step="0.01" inputMode="decimal" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function EmojiPick({ value, onChange }) {
  return (
    <div className="emojis">
      {EMOJIS.map((e) => <button type="button" key={e} className={value === e ? 'on' : ''} aria-label={'Use ' + e} aria-pressed={value === e} onClick={() => onChange(e)}>{e}</button>)}
      <input aria-label="Or type your own emoji" maxLength={12} value={EMOJIS.includes(value) ? '' : value} placeholder="Other" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function ColorPick({ value, onChange }) {
  return (
    <div className="swatches">
      {COLORS.map((c) => <button type="button" key={c} style={{ background: c }} className={value === c ? 'on' : ''} aria-label={'Colour ' + c} aria-pressed={value === c} onClick={() => onChange(c)} />)}
    </div>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState('system');
  useEffect(() => { try { setTheme(localStorage.getItem('pw-theme') || 'system'); } catch {} }, []);
  const apply = (t) => {
    setTheme(t);
    try { if (t === 'system') localStorage.removeItem('pw-theme'); else localStorage.setItem('pw-theme', t); } catch {}
    if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  };
  return [theme, apply];
}
