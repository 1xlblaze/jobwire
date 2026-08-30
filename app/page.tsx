import { Desk } from "@/components/desk";
import { getSupabase, type JobRow } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  let jobs: JobRow[] = [];
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("jobwire_jobs")
      .select("*")
      .order("posted_at", { ascending: false })
      .limit(200);
    jobs = (data || []) as JobRow[];
  } catch {
    jobs = [];
  }
  return (
    <main className="min-h-screen bg-[#3a3329] p-4">
      <Desk initialJobs={jobs} />
    </main>
  );
}
