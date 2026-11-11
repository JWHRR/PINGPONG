'use client';

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserClient } from './supabase/client';
import { isConfigured } from './supabase/env';
import type { Category, Draw, Match, Participant, Settings, Venue } from './types';

export interface TournamentData {
  configured: boolean;
  loading: boolean;
  error: string | null;
  settings: Settings | null;
  categories: Category[];
  participants: Participant[];
  venues: Venue[];
  draws: Draw[];
  matches: Match[];
  session: Session | null;
  isAdmin: boolean;
  authReady: boolean;
  live: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  // lookups
  participantsById: Map<string, Participant>;
  categoriesById: Map<string, Category>;
  venuesById: Map<string, Venue>;
  publishedDrawByCategory: Map<string, Draw>;
  previewDrawByCategory: Map<string, Draw>;
  /** Matches of published draws only (what the public sees). */
  publicMatches: Match[];
}

const Ctx = createContext<TournamentData | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const sb = getBrowserClient();
  const [state, setState] = useState({
    loading: isConfigured,
    error: null as string | null,
    settings: null as Settings | null,
    categories: [] as Category[],
    participants: [] as Participant[],
    venues: [] as Venue[],
    draws: [] as Draw[],
    matches: [] as Match[],
    lastUpdated: null as Date | null,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [live, setLive] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);
  const again = useRef(false);

  const load = useCallback(async () => {
    if (!sb) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    if (inflight.current) {
      again.current = true;
      return inflight.current;
    }
    const run = async () => {
      try {
        const [settings, categories, participants, venues, draws, matches] = await Promise.all([
          sb.from('settings').select('*').eq('id', 1).maybeSingle(),
          sb.from('categories').select('*').order('sort_order').order('name'),
          sb.from('participants').select('*').order('name').limit(5000),
          sb.from('venues').select('*').order('name'),
          sb.from('draws').select('*').in('status', ['published', 'preview']).order('version'),
          sb.from('matches').select('*').order('number').limit(10000),
        ]);
        const err = [settings, categories, participants, venues, draws, matches].find((r) => r.error)?.error;
        if (err) throw new Error(err.message);
        const drawIds = new Set((draws.data as Draw[]).map((d) => d.id));
        setState({
          loading: false,
          error: null,
          settings: settings.data as Settings | null,
          categories: categories.data as Category[],
          participants: participants.data as Participant[],
          venues: venues.data as Venue[],
          draws: draws.data as Draw[],
          matches: (matches.data as Match[]).filter((m) => drawIds.has(m.draw_id)),
          lastUpdated: new Date(),
        });
      } catch (e) {
        setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load data' }));
      }
    };
    inflight.current = run().finally(() => {
      inflight.current = null;
      if (again.current) {
        again.current = false;
        void load();
      }
    });
    return inflight.current;
  }, [sb]);

  // Auth state
  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!sb) return;
    if (!userId) {
      setIsAdmin(false);
      setAuthReady(true);
      void load();
      return;
    }
    let cancelled = false;
    sb.from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setIsAdmin(!!data);
        setAuthReady(true);
        void load(); // admins also see draw previews
      });
    return () => {
      cancelled = true;
    };
  }, [sb, userId, load]);

  // Realtime: any change anywhere refreshes every page
  useEffect(() => {
    if (!sb) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 250);
    };
    const channel = sb.channel('tournament-live');
    for (const table of ['settings', 'categories', 'participants', 'venues', 'draws', 'matches']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
    }
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'));
    // Fallback polling in case websockets are blocked on the venue network
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30000);
    const onVis = () => document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVis);
      void sb.removeChannel(channel);
    };
  }, [sb, load]);

  const value = useMemo<TournamentData>(() => {
    const participantsById = new Map(state.participants.map((p) => [p.id, p]));
    const categoriesById = new Map(state.categories.map((c) => [c.id, c]));
    const venuesById = new Map(state.venues.map((v) => [v.id, v]));
    const publishedDrawByCategory = new Map<string, Draw>();
    const previewDrawByCategory = new Map<string, Draw>();
    for (const d of state.draws) {
      if (d.status === 'published') publishedDrawByCategory.set(d.category_id, d);
      if (d.status === 'preview') previewDrawByCategory.set(d.category_id, d);
    }
    const publishedIds = new Set([...publishedDrawByCategory.values()].map((d) => d.id));
    return {
      configured: isConfigured,
      ...state,
      session,
      isAdmin,
      authReady,
      live,
      refresh: load,
      participantsById,
      categoriesById,
      venuesById,
      publishedDrawByCategory,
      previewDrawByCategory,
      publicMatches: state.matches.filter((m) => publishedIds.has(m.draw_id)),
    };
  }, [state, session, isAdmin, authReady, live, load]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTournament(): TournamentData {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTournament must be used inside <TournamentProvider>');
  return v;
}
