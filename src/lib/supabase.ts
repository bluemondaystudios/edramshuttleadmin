import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/**
 * The browser only ever gets the publishable (anon) key. It is public by design:
 * Row Level Security in the database decides what a signed-in user may see.
 * Null when the app was built without Supabase settings (e.g. before the project exists).
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          // PKCE puts auth redirects in ?code= instead of the URL hash, which the hash router owns.
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false, // v1 has no email links: passwords are reset in the Supabase dashboard
        },
      })
    : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('The app is not connected to its database yet.');
  return supabase;
}

/** Turns Supabase and network errors into plain language for the screen. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error);
  if (/invalid login credentials/i.test(message)) return "That email and password don't match. Check them and try again.";
  if (/failed to fetch|network|load failed/i.test(message)) return "Couldn't reach the server. Check your signal or Wi-Fi and try again.";
  if (/email not confirmed/i.test(message)) return 'This account has not been confirmed yet. Ask the developer to confirm it in Supabase.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute, then try again.';
  return message || 'Something went wrong. Please try again.';
}
