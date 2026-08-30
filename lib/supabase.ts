import { createClient } from "@supabase/supabase-js";

// Publishable defaults so a Vercel deploy works before project env is set.
// Override with NEXT_PUBLIC_SUPABASE_* in the Vercel dashboard if you switch projects.
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kqolyvmwcsqilnakuewt.supabase.co";
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DDdH_lpoqNZV4ySChv2IAw_SCDjef5n";

export function getSupabase() {
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or publishable key");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type JobRow = {
  id: number;
  source: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string | null;
  description: string | null;
  tags: string[];
  posted_at: string | null;
  discovered_at: string;
  status: "new" | "saved" | "dismissed";
};
