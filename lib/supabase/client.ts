import { createClient } from "@supabase/supabase-js";

/**
 * Browser-safe Supabase client using the anon key.
 * Only ever exposes what your RLS policies allow.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 * 
 * 
 */

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);