import React, { useEffect, useRef } from 'react';
import { PhoneCall } from 'lucide-react';
import { HELPLINES, tel } from '../../data/helplines';

export const minutesAgo = (iso) => (iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null);

export const timeAgo = (iso) => {
  const m = minutesAgo(iso);
  if (m == null) return 'never';
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString();
};

export const ER_STATUS = {
  ACCEPTING: ['Accepting patients', 'bg-emerald-100 text-emerald-800'],
  LIMITED: ['Limited intake', 'bg-amber-100 text-amber-900'],
  DIVERSION: ['ER full (diversion)', 'bg-red-100 text-red-800'],
};

export const ErStatusBadge = ({ status, note }) => {
  const [label, style] = ER_STATUS[status] || ER_STATUS.ACCEPTING;
  return <span className={`cc-chip ${style}`} title={note || undefined}>{label}</span>;
};

export const TRIAGE = {
  RED: ['Red: critical', 'bg-red-600 text-white'],
  YELLOW: ['Yellow: serious', 'bg-amber-400 text-stone-950'],
  GREEN: ['Green: stable', 'bg-emerald-600 text-white'],
};

/** One-line pill: fixed height and padding so it lines up next to headings, never wraps or shrinks. */
export const TriageBadge = ({ level }) =>
  level ? (
    <span className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold leading-none ${TRIAGE[level][1]}`}>
      {TRIAGE[level][0]}
    </span>
  ) : null;

export const OwnershipBadge = ({ ownership }) =>
  ownership === 'PUBLIC' ? (
    <span className="cc-chip bg-sky-100 text-sky-800" title="Government or municipal hospital: free or low-cost treatment">Govt · free/low cost</span>
  ) : ownership === 'PRIVATE' ? (
    <span className="cc-chip bg-stone-100 text-stone-600">Private</span>
  ) : null;

/** Big tap-to-call buttons for the numbers that work without this website. */
export const HelplineStrip = ({ compact = false, numbers }) => {
  const list = numbers ? HELPLINES.filter((h) => numbers.includes(h.number)) : HELPLINES;
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
      {list.map((h) => (
        <a key={h.number} href={tel(h.number)} className="cc-card px-3 py-2.5 flex items-center gap-3 hover:border-red-400 transition" aria-label={`Call ${h.number}, ${h.label}`}>
          <span className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0"><PhoneCall className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block text-xl font-black leading-none tabular-nums">{h.number}</span>
            <span className="block text-[11px] font-semibold text-stone-500 truncate" title={h.detail}>{h.label}</span>
          </span>
        </a>
      ))}
    </div>
  );
};

export const Field = ({ label, children }) => (
  <div>
    <dt className="cc-label !mb-0.5">{label}</dt>
    <dd className="text-sm font-semibold text-stone-800">{children}</dd>
  </div>
);

export const Avatar = ({ name, className = 'w-12 h-12 text-base' }) => {
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  return (
    <span className={`rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black flex items-center justify-center shrink-0 ${className}`} aria-hidden="true">
      {initials}
    </span>
  );
};

export const Pill = ({ on, onClick, children, tone = 'amber' }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
      on ? (tone === 'red' ? 'bg-red-600 border-red-600 text-white' : 'bg-amber-500 border-amber-500 text-stone-950') : 'bg-white border-stone-300 text-stone-700 hover:border-amber-500'
    }`}
  >
    {children}
  </button>
);

export const ErrorNote = ({ error }) =>
  error ? <div className="cc-card border-red-300 bg-red-50 p-4 text-sm text-red-800">{error.message}</div> : null;

/**
 * Modal confirmation. `children` explains what will happen; the confirm button stays disabled
 * (and says "Working…") until the server has answered, so nothing looks done before it is.
 */
export const ConfirmDialog = ({ title, confirmLabel, cancelLabel = 'Keep it', busy = false, canConfirm = true, onConfirm, onClose, tone = 'danger', children }) => {
  const first = useRef(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (ev) => { if (ev.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/50 p-4" onMouseDown={(ev) => { if (ev.target === ev.currentTarget && !busy) onClose(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="cc-confirm-title" className="cc-card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <h2 id="cc-confirm-title" className="text-xl font-black">{title}</h2>
        <div className="text-sm text-stone-600 space-y-3">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          <button ref={first} type="button" onClick={onClose} disabled={busy} className="cc-btn-outline !py-2.5">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={busy || !canConfirm} className={`cc-btn !py-2.5 text-white disabled:opacity-50 ${tone === 'danger' ? 'bg-red-700 hover:bg-red-800' : 'bg-stone-900 hover:bg-stone-800'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
