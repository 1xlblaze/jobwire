import type { RawJob } from "./collector";

const LINKEDIN_ACTOR =
  process.env.APIFY_LINKEDIN_ACTOR || "mfrostbutter/linkedin-jobs-scraper";
const NAUKRI_ACTOR =
  process.env.APIFY_NAUKRI_ACTOR || "blackfalcondata/naukri-jobs-feed";
const MAX_RESULTS = Math.min(
  40,
  Math.max(1, Number(process.env.APIFY_MAX_RESULTS || 15) || 15),
);
const WAIT_SECONDS = Math.min(
  50,
  Math.max(10, Number(process.env.APIFY_WAIT_SECONDS || 40) || 40),
);

export function getApifyToken() {
  return process.env.APIFY_TOKEN?.trim() || "";
}

function actorPath(id: string) {
  return encodeURIComponent(id.replace("/", "~"));
}

function asText(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return asText(
      record.city ||
        record.name ||
        record.label ||
        record.location ||
        record.formatted ||
        "",
    );
  }
  return "";
}

function asIso(value: unknown) {
  if (!value) return null;
  const ts = Date.parse(String(value));
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
}

async function runActor(actorId: string, input: Record<string, unknown>) {
  const token = getApifyToken();
  if (!token) {
    throw new Error("APIFY_TOKEN is not set");
  }
  const url = `https://api.apify.com/v2/acts/${actorPath(actorId)}/run-sync-get-dataset-items?timeout=${WAIT_SECONDS}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Apify ${actorId} ${res.status}: ${text.slice(0, 280)}`);
  }
  const payload = text ? JSON.parse(text) : [];
  if (!Array.isArray(payload)) {
    throw new Error(`Apify ${actorId} returned unexpected payload`);
  }
  return payload as Record<string, unknown>[];
}

export async function apifyLinkedin(): Promise<RawJob[]> {
  const items = await runActor(LINKEDIN_ACTOR, {
    keywords: "Python Developer",
    location: "Bengaluru",
    workType: "any",
    datePosted: "past_24h",
    maxResults: MAX_RESULTS,
    fetchFullDescription: false,
  });
  return items.map((item) => ({
    source: "linkedin",
    external_id: asText(item.id || item.jobId || item.link || item.url),
    title: asText(item.title || item.jobTitle),
    company: asText(item.companyName || item.company),
    location: asText(item.location) || "Bengaluru",
    url: asText(item.link || item.url || item.applyUrl),
    description: asText(item.descriptionText || item.description || item.jobDescription),
    tags: ["linkedin", "apify", "python", ...asText(item.jobFunctions).split(", ").filter(Boolean)],
    posted_at: asIso(item.postedAt || item.publishedAt || item.datePosted) || new Date().toISOString(),
  }));
}

export async function apifyNaukri(): Promise<RawJob[]> {
  const items = await runActor(NAUKRI_ACTOR, {
    keyword: "python developer",
    location: "Bangalore",
    datePosted: "1",
    maxResults: MAX_RESULTS,
    compact: true,
  });
  return items.map((item) => ({
    source: "naukri",
    external_id: asText(item.jobId || item.id || item.portalUrl),
    title: asText(item.title || item.jobTitle),
    company: asText(item.companyName || item.company),
    location: asText(item.location) || "Bangalore",
    url: asText(item.portalUrl || item.url || item.jobUrl),
    description: asText(item.description || item.descriptionText || item.jobDescription),
    tags: [
      "naukri",
      "apify",
      "python",
      ...(Array.isArray(item.skills) ? item.skills.map(asText) : []),
    ],
    posted_at: asIso(item.createdDate || item.postedAt || item.datePosted) || new Date().toISOString(),
  }));
}
