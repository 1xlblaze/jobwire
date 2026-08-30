import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
