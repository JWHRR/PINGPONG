// Next.js only inlines NEXT_PUBLIC_* variables when they are referenced literally,
// so each accepted name is written out explicitly.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

/** Accepts the legacy anon key or the newer publishable key (Supabase / Vercel integration naming). */
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  '';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
