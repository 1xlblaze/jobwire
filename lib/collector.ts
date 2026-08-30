import { getSupabase } from "./supabase";

const STACK = /\b(python|django|fastapi|flask|pytest|celery|sqlalchemy)\b/i;
const BACKEND = /\b(backend|back-end|python developer|python engineer)\b/i;
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

export type RawJob = {
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  tags: string[];
  posted_at: string | null;
};

function stripHtml(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPythonRole(title: string, description: string, tags: string[]) {
  if (STACK.test(title) || STACK.test(tags.join(" "))) return true;
  return BACKEND.test(title) && STACK.test(description);
}

function isRecent(iso: string | null) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= LOOKBACK_MS;
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "User-Agent": "Jobwire/1.0 (public feed reader)",
      ...(init?.headers || {}),
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function remoteok(): Promise<RawJob[]> {
  const payload = await fetchJson("https://remoteok.com/api");
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((item) => item && item.id && (item.position || item.title))
    .map((item: Record<string, unknown>) => {
      const epoch = Number(item.epoch);
      const posted = Number.isFinite(epoch)
        ? new Date(epoch * 1000).toISOString()
        : item.date
          ? new Date(String(item.date)).toISOString()
          : null;
      return {
        source: "remoteok",
        external_id: String(item.id || item.slug),
        title: String(item.position || item.title || ""),
        company: String(item.company || ""),
        location: String(item.location || "Remote"),
        url: String(item.url || item.apply_url || ""),
        description: stripHtml(String(item.description || "")),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        posted_at: posted,
      };
    });
}

async function remotive(): Promise<RawJob[]> {
  const payload = await fetchJson("https://remotive.com/api/remote-jobs?search=python&limit=100");
  return (payload.jobs || []).map((item: Record<string, unknown>) => ({
    source: "remotive",
    external_id: String(item.id),
    title: String(item.title || ""),
    company: String(item.company_name || ""),
    location: String(item.candidate_required_location || "Remote"),
    url: String(item.url || ""),
    description: stripHtml(String(item.description || "")),
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    posted_at: item.publication_date ? new Date(String(item.publication_date)).toISOString() : null,
  }));
}

async function arbeitnow(): Promise<RawJob[]> {
  const payload = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
  return (payload.data || []).map((item: Record<string, unknown>) => {
    const created = item.created_at;
    const posted =
      typeof created === "number"
        ? new Date(created * (created > 10_000_000_000 ? 1 : 1000)).toISOString()
        : created
          ? new Date(String(created)).toISOString()
          : null;
    return {
      source: "arbeitnow",
      external_id: String(item.slug || item.title),
      title: String(item.title || ""),
      company: String(item.company_name || ""),
      location: String(item.location || (item.remote ? "Remote" : "")),
      url: String(item.url || ""),
      description: stripHtml(String(item.description || "")),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      posted_at: posted,
    };
  });
}

async function jobicy(): Promise<RawJob[]> {
  const payload = await fetchJson("https://jobicy.com/api/v2/remote-jobs?count=50&tag=python");
  return (payload.jobs || []).map((item: Record<string, unknown>) => ({
    source: "jobicy",
    external_id: String(item.id || item.jobTitle),
    title: String(item.jobTitle || item.title || ""),
    company: String(item.companyName || ""),
    location: String(item.jobGeo || "Remote"),
    url: String(item.url || item.jobUrl || ""),
    description: stripHtml(String(item.jobDescription || item.jobExcerpt || "")),
    tags: Array.isArray(item.jobTags) ? item.jobTags.map(String) : [],
    posted_at: item.pubDate ? new Date(String(item.pubDate)).toISOString() : null,
  }));
}

const PUBLIC_SOURCES: Record<string, () => Promise<RawJob[]>> = {
  remoteok,
  remotive,
  arbeitnow,
  jobicy,
};

export type CollectResult = {
  source: string;
  found: number;
  inserted: number;
  error: string | null;
};

async function ingest(
  name: string,
  fetchSource: () => Promise<RawJob[]>,
): Promise<CollectResult> {
  const supabase = getSupabase();
  const started = new Date().toISOString();
  try {
    const raw = await fetchSource();
    const matched = raw.filter(
      (job) =>
        job.title &&
        isPythonRole(job.title, job.description, job.tags) &&
        isRecent(job.posted_at),
    );
    let inserted = 0;
    for (const job of matched) {
      const { error } = await supabase.from("jobwire_jobs").insert({
        source: job.source,
        external_id: job.external_id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        description: job.description,
        tags: job.tags,
        posted_at: job.posted_at,
        status: "new",
      });
      if (!error) inserted += 1;
    }
    await supabase.from("jobwire_fetch_runs").insert({
      source: name,
      started_at: started,
      finished_at: new Date().toISOString(),
      jobs_found: matched.length,
      jobs_inserted: inserted,
      error: null,
    });
    return { source: name, found: matched.length, inserted, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("jobwire_fetch_runs").insert({
      source: name,
      started_at: started,
      finished_at: new Date().toISOString(),
      jobs_found: 0,
      jobs_inserted: 0,
      error: message,
    });
    return { source: name, found: 0, inserted: 0, error: message };
  }
}

export async function collectAll(options: { apify?: boolean } = {}) {
  const publicResults = await Promise.all(
    Object.entries(PUBLIC_SOURCES).map(([name, fetchSource]) => ingest(name, fetchSource)),
  );

  if (!options.apify) {
    return publicResults;
  }

  const { apifyLinkedin, apifyNaukri, getApifyToken } = await import("./apify");
  if (!getApifyToken()) {
    return [
      ...publicResults,
      {
        source: "linkedin",
        found: 0,
        inserted: 0,
        error: "Set APIFY_TOKEN to pull LinkedIn via Apify",
      },
      {
        source: "naukri",
        found: 0,
        inserted: 0,
        error: "Set APIFY_TOKEN to pull Naukri via Apify",
      },
    ];
  }

  const apifyResults = await Promise.all([
    ingest("linkedin", apifyLinkedin),
    ingest("naukri", apifyNaukri),
  ]);
  return [...publicResults, ...apifyResults];
}
