import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true, supabaseConfigured: isConfigured, time: new Date().toISOString() });
}
