'use client';

import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { MatchStatus, Sport } from '@/lib/types';
import { MATCH_STATUS_LABEL } from '@/lib/types';

export function cx(...v: (string | false | null | undefined)[]) {
  return v.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Sport icons (custom, so both sports read clearly)
// ---------------------------------------------------------------------------
export function PaddleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <circle cx="10" cy="9" r="6.5" />
      <path d="M14.6 13.6 20 19a1.6 1.6 0 0 1-2.3 2.3l-5.4-5.4" strokeLinecap="round" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShuttleIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden>
      <path d="M9.5 14.5 4 9l1.5-5 5 1.5 5.5 5.5" strokeLinejoin="round" />
      <path d="M7 4.8 9.6 12M5 7l7 2.6" strokeLinecap="round" />
      <circle cx="16.5" cy="16.5" r="3.5" />
    </svg>
  );
}

export function SportIcon({ sport, className }: { sport: Sport; className?: string }) {
  return sport === 'table_tennis' ? <PaddleIcon className={className} /> : <ShuttleIcon className={className} />;
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------
export const STATUS_STYLE: Record<MatchStatus, { pill: string; dot: string; bar: string }> = {
  pending: { pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-300' },
  scheduled: { pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500', bar: 'bg-sky-500' },
  in_progress: { pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500', bar: 'bg-red-500' },
  completed: { pill: 'bg-pitch-50 text-pitch-800 ring-pitch-200', dot: 'bg-pitch-500', bar: 'bg-pitch-500' },
  walkover: { pill: 'bg-amber-50 text-amber-800 ring-amber-200', dot: 'bg-amber-500', bar: 'bg-amber-500' },
  bye: { pill: 'bg-slate-50 text-slate-500 ring-slate-200', dot: 'bg-slate-300', bar: 'bg-slate-200' },
};

export function StatusBadge({ status, className }: { status: MatchStatus; className?: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        s.pill,
        className,
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', s.dot, status === 'in_progress' && 'animate-livepulse')} />
      {status === 'in_progress' ? 'LIVE' : MATCH_STATUS_LABEL[status]}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cx('relative inline-flex h-2.5 w-2.5', className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
    </span>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className)} aria-label="Loading" />;
}

export function EmptyState({
  icon,
  title,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('card flex flex-col items-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-500">{icon}</div>}
      <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-navy-900">{title}</h3>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-shimmer rounded-xl bg-[linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92vh] w-full animate-fadein flex-col overflow-hidden rounded-t-3xl bg-white shadow-lift outline-none sm:rounded-3xl',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0 flex-1 font-display text-lg font-semibold uppercase tracking-wide text-navy-900">{title}</div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog (with optional typed confirmation for destructive actions)
// ---------------------------------------------------------------------------
export interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** If set, the user must type this exact text to enable the confirm button. */
  typeToConfirm?: string;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    setTyped('');
    return new Promise<boolean>((res) => (resolver.current = res));
  }, []);
  const close = (v: boolean) => {
    resolver.current?.(v);
    setOpts(null);
  };
  const ok = !opts?.typeToConfirm || typed.trim() === opts.typeToConfirm.trim();
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        size="sm"
        title={
          <span className="flex items-center gap-2">
            {opts?.danger && <AlertTriangle className="h-5 w-5 text-red-600" />}
            {opts?.title}
          </span>
        }
        footer={
          <>
            <button className="btn-secondary" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={opts?.danger ? 'btn-danger' : 'btn-primary'} disabled={!ok} onClick={() => close(true)}>
              {opts?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-slate-600">
          <div>{opts?.message}</div>
          {opts?.typeToConfirm && (
            <div>
              <label className="label">
                Type <span className="font-mono normal-case text-navy-900">{opts.typeToConfirm}</span> to confirm
              </label>
              <input className="input" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
            </div>
          )}
        </div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm outside ConfirmProvider');
  return c;
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
const ToastCtx = createContext<((kind: ToastKind, text: string) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[200] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex w-full max-w-sm animate-fadein items-start gap-2 rounded-2xl px-4 py-3 text-sm shadow-lift ring-1',
              t.kind === 'success' && 'bg-white text-navy-900 ring-pitch-200',
              t.kind === 'error' && 'bg-white text-red-800 ring-red-200',
              t.kind === 'info' && 'bg-white text-navy-900 ring-slate-200',
            )}
            role="status"
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pitch-600" />}
            {t.kind === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            {t.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const t = useContext(ToastCtx);
  if (!t) throw new Error('useToast outside ToastProvider');
  return t;
}
