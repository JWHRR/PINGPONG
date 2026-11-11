'use client';

import { GitBranch, Home, Lock, Menu, Radio, Trophy, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTournament } from '@/lib/data';
import { LiveDot, cx } from './ui';

const LINKS = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/draw', label: 'Draw', icon: GitBranch },
  { href: '/live', label: 'Match Center', icon: Radio },
  { href: '/participants', label: 'Participants', icon: Users },
];

export function Nav() {
  const path = usePathname();
  const { settings, publicMatches, isAdmin } = useTournament();
  const [open, setOpen] = useState(false);
  const liveCount = publicMatches.filter((m) => m.status === 'in_progress').length;
  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-950/95 text-white backdrop-blur supports-[backdrop-filter]:bg-navy-950/85">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pitch-500 to-pitch-700 shadow-inner">
            <Trophy className="h-5 w-5 text-white" />
          </span>
          <span className="min-w-0 leading-none">
            <span className="block truncate font-display text-lg font-bold uppercase tracking-wide">
              {settings?.tournament_name ?? 'Smash Cup'}
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-pitch-300 sm:block">
              Table Tennis · Badminton
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cx(
                'relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition',
                active(l.href) ? 'bg-white/10 text-white' : 'text-navy-200 hover:bg-white/5 hover:text-white',
              )}
            >
              <l.icon className="h-4 w-4" />
              {l.label}
              {l.href === '/live' && liveCount > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-1.5 text-[11px] text-red-200">
                  <LiveDot className="h-2 w-2" />
                  {liveCount}
                </span>
              )}
            </Link>
          ))}
          <Link
            href="/admin"
            className={cx(
              'ml-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition',
              active('/admin')
                ? 'border-pitch-400 bg-pitch-500/15 text-pitch-200'
                : 'border-white/15 text-navy-100 hover:border-white/30 hover:text-white',
            )}
          >
            <Lock className="h-4 w-4" />
            {isAdmin ? 'Dashboard' : 'Admin'}
          </Link>
        </nav>

        <button className="ml-auto rounded-xl p-2 text-navy-100 hover:bg-white/10 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-navy-950 px-4 pb-4 pt-2 md:hidden">
          {[...LINKS, { href: '/admin', label: isAdmin ? 'Admin dashboard' : 'Admin', icon: Lock }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cx(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-base font-semibold',
                active(l.href) ? 'bg-white/10 text-white' : 'text-navy-200',
              )}
            >
              <l.icon className="h-5 w-5" />
              {l.label}
              {l.href === '/live' && liveCount > 0 && <span className="ml-auto text-xs text-red-300">{liveCount} live</span>}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function Footer() {
  const { settings, live, lastUpdated } = useTournament();
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-page flex flex-col gap-2 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {settings?.tournament_name ?? 'Smash Cup'}
          {settings?.organizer ? ` · Organised by ${settings.organizer}` : ''}
        </span>
        <span className="flex items-center gap-2">
          <span className={cx('h-2 w-2 rounded-full', live ? 'bg-pitch-500' : 'bg-slate-300')} />
          {live ? 'Live updates connected' : 'Connecting to live updates…'}
          {lastUpdated && <span className="text-slate-400">· updated {lastUpdated.toLocaleTimeString()}</span>}
        </span>
      </div>
    </footer>
  );
}
