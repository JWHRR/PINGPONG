'use client';

import { AlertTriangle, Database } from 'lucide-react';
import { useTournament } from '@/lib/data';

/** Shown when env vars are missing or the database cannot be reached. */
export function SetupNotice() {
  const { configured, error } = useTournament();
  if (configured && !error) return null;
  return (
    <div className="container-page mt-6">
      <div className="card flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {configured ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : <Database className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          {configured ? (
            <>
              <div className="font-semibold">Could not load tournament data</div>
              <div className="mt-0.5">{error}. Check that <code>supabase/schema.sql</code> has been run on the project.</div>
            </>
          ) : (
            <>
              <div className="font-semibold">Database not connected</div>
              <div className="mt-0.5">
                Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (or <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>) (see README → Installation),
                then redeploy.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
