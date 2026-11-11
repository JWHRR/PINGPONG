'use client';

import {
  ClipboardList,
  GitBranch,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  Settings as SettingsIcon,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { AuditLog } from '@/components/admin/AuditLog';
import { CategoriesAdmin } from '@/components/admin/CategoriesAdmin';
import { DrawsAdmin } from '@/components/admin/DrawsAdmin';
import { MatchesAdmin } from '@/components/admin/MatchesAdmin';
import { Overview } from '@/components/admin/Overview';
import { ParticipantsAdmin } from '@/components/admin/ParticipantsAdmin';
import { SettingsAdmin } from '@/components/admin/SettingsAdmin';
import { VenuesAdmin } from '@/components/admin/VenuesAdmin';
import { SetupNotice } from '@/components/SetupNotice';
import { Spinner, cx } from '@/components/ui';
import { useTournament } from '@/lib/data';
import { getBrowserClient } from '@/lib/supabase/client';

export type AdminTab = 'overview' | 'participants' | 'categories' | 'draws' | 'matches' | 'venues' | 'settings' | 'audit';

const TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'participants', label: 'Participants', icon: Users },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'draws', label: 'Draws', icon: GitBranch },
  { id: 'matches', label: 'Matches & scores', icon: Swords },
  { id: 'venues', label: 'Courts & tables', icon: MapPin },
  { id: 'settings', label: 'Tournament info', icon: SettingsIcon },
  { id: 'audit', label: 'Audit log', icon: ClipboardList },
];

export default function AdminPage() {
  const { configured, session, isAdmin, authReady } = useTournament();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [focusCategory, setFocusCategory] = useState<string | null>(null);

  if (!configured) return <SetupNotice />;
  if (!authReady) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-8 w-8 text-navy-400" />
      </div>
    );
  }
  if (!session) return <Login />;
  if (!isAdmin) return <NotAdmin email={session.user.email ?? ''} userId={session.user.id} />;

  const go = (t: AdminTab, categoryId?: string) => {
    if (categoryId) setFocusCategory(categoryId);
    setTab(t);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container-page py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow flex items-center gap-1.5 text-pitch-700">
            <ShieldCheck className="h-4 w-4" /> Organiser dashboard
          </div>
          <h1 className="font-display text-3xl font-bold uppercase text-navy-900">Tournament control</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="hidden sm:inline">{session.user.email}</span>
          <button className="btn-secondary btn-sm" onClick={() => getBrowserClient()?.auth.signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              className={cx(
                'flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                tab === t.id ? 'bg-navy-900 text-white shadow-card' : 'text-navy-700 hover:bg-white',
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          {tab === 'overview' && <Overview go={go} />}
          {tab === 'participants' && <ParticipantsAdmin initialCategory={focusCategory} />}
          {tab === 'categories' && <CategoriesAdmin go={go} />}
          {tab === 'draws' && <DrawsAdmin initialCategory={focusCategory} onCategory={setFocusCategory} go={go} />}
          {tab === 'matches' && <MatchesAdmin initialCategory={focusCategory} onCategory={setFocusCategory} />}
          {tab === 'venues' && <VenuesAdmin />}
          {tab === 'settings' && <SettingsAdmin />}
          {tab === 'audit' && <AuditLog />}
        </section>
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = (await getBrowserClient()?.auth.signInWithPassword({ email: email.trim(), password })) ?? {};
    if (error) setError(error.message === 'Invalid login credentials' ? 'Incorrect e-mail or password.' : error.message);
    setBusy(false);
  };
  return (
    <div className="container-page flex justify-center py-16">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-900 text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-center font-display text-2xl font-bold uppercase text-navy-900">Organiser sign in</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Administrator access only.</p>
        <div className="mt-6 space-y-3">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Sign in
          </button>
        </div>
      </form>
    </div>
  );
}

function NotAdmin({ email, userId }: { email: string; userId: string }) {
  return (
    <div className="container-page flex justify-center py-16">
      <div className="card w-full max-w-lg p-6">
        <h1 className="font-display text-2xl font-bold uppercase text-navy-900">Not an administrator</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are signed in as <b>{email}</b>, but this account has not been granted administrator rights. An existing administrator
          (or the project owner, in the Supabase SQL editor) can grant access with:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-950 p-3 text-xs text-pitch-200">
          {`insert into public.admins (user_id, email)\nvalues ('${userId}', '${email}');`}
        </pre>
        <button className="btn-secondary mt-4" onClick={() => getBrowserClient()?.auth.signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
