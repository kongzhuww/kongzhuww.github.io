import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// These two values are safe to ship in the browser:
// the publishable (anon) key is public by design and protected by Row Level Security.
// NEVER put the `sb_secret_...` / service_role key or the database password here.
const SUPABASE_URL = "https://auxlxuyhhzguxjvneanw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bnMlxTYk9CEk8INMsxW_ag_HF8ZugLW";

export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null;
  if (typeof window === "undefined") return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "lw-kb-auth",
      },
    });
  }
  return client;
}

export type KnowledgeRow = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};
