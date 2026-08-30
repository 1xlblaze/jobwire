"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { JobRow } from "@/lib/supabase";
import Link from "next/link";
import { useMemo, useState } from "react";

export function Desk({ initialJobs }: { initialJobs: JobRow[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [pollStatus, setPollStatus] = useState("Idle");
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState("");

  const visible = useMemo(() => {
    return jobs.filter((job) => {
      if (status && job.status !== status) return false;
      if (source && job.source !== source) return false;
      if (query) {
        const hay = `${job.title} ${job.company} ${job.description}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, query, source, status]);

  const selected = jobs.find((job) => job.id === selectedId) || null;

  async function pullWire() {
    setBusy(true);
    setPollStatus("Fetching public feeds…");
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const data = await res.json();
      const bits = (data.results || []).map((row: { source: string; inserted: number; error?: string }) =>
        row.error ? `${row.source}: ${row.error}` : `${row.source} +${row.inserted}`,
      );
      setPollStatus(bits.join(" · ") || "Done");
      window.location.reload();
    } catch (err) {
      setPollStatus(err instanceof Error ? err.message : "Collect failed");
    } finally {
      setBusy(false);
    }
  }

  async function setJobStatus(id: number, next: string) {
    const res = await fetch(`/api/jobs/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const updated = await res.json();
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, status: updated.status } : job)));
  }

  async function draft(event: React.FormEvent) {
    event.preventDefault();
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, job_id: selectedId }),
    });
    const data = await res.json();
    setAnswer(data.answer || data.detail || "");
    setMeta(data.source || "");
  }

  return (
    <div className="mx-auto max-w-6xl my-6 border border-[#1b1712] bg-[#f3ead8] p-7 text-[#1b1712] shadow-[8px_10px_0_#1b1712]">
      <header className="border-b-[3px] border-double border-[#1b1712] pb-4 mb-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9c1c12]">
          Public feeds only · No LinkedIn/Naukri auto-apply
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <h1 className="font-serif text-6xl font-bold leading-none mt-2">The Jobwire</h1>
          <div className="font-mono text-sm">Python openings, last 24h</div>
        </div>
        <p className="mt-3 max-w-[70ch] text-[17px] leading-snug">
          Public Python roles land in Supabase. Screening answers are drafted from the local
          profile. You still submit every application yourself.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button disabled={busy} onClick={pullWire} className="rounded-none bg-[#1b1712] text-[#f3ead8] uppercase font-mono text-xs">
            Pull the wire
          </Button>
          <Button asChild variant="outline" className="rounded-none border-[#1b1712] uppercase font-mono text-xs">
            <Link href="/practice">Practice form</Link>
          </Button>
          <span className="text-sm text-[#6b6256]">{pollStatus}</span>
          <div className="ml-auto flex gap-2 font-mono text-[11px]">
            <span className="border border-[#c9bba0] bg-[#ebe1cc] px-2 py-1">total {jobs.length}</span>
            <span className="border border-[#c9bba0] bg-[#ebe1cc] px-2 py-1">
              new {jobs.filter((j) => j.status === "new").length}
            </span>
          </div>
        </div>
      </header>

      <div className="grid gap-5 border-b border-[#c9bba0] pb-5 md:grid-cols-[360px_1fr]">
        <section>
          <div className="mb-3 grid gap-2">
            <Input placeholder="Search title or company" value={query} onChange={(e) => setQuery(e.target.value)} className="rounded-none bg-[#fffaf0] border-[#c9bba0]" />
            <select className="border border-[#c9bba0] bg-[#fffaf0] p-2" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="new">New</option>
              <option value="saved">Saved</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select className="border border-[#c9bba0] bg-[#fffaf0] p-2" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              <option value="remoteok">RemoteOK</option>
              <option value="remotive">Remotive</option>
              <option value="arbeitnow">Arbeitnow</option>
              <option value="jobicy">Jobicy</option>
            </select>
          </div>
          <div className="flex max-h-[620px] flex-col gap-2 overflow-auto">
            {visible.length === 0 ? (
              <div className="text-[#6b6256]">The wire is quiet. Pull public boards.</div>
            ) : (
              visible.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => setSelectedId(job.id)}
                  className={`border bg-[#fffaf0] p-3 text-left ${selectedId === job.id ? "border-[#1b1712] shadow-[3px_3px_0_#1b1712]" : "border-[#c9bba0]"}`}
                >
                  <div className="font-serif text-lg">{job.title}</div>
                  <div className="font-mono text-[11px] text-[#6b6256]">
                    <span className={job.status === "saved" ? "text-[#2f4a38]" : "text-[#9c1c12]"}>{job.status}</span>
                    {" · "}
                    {job.company || "Unknown co."} · {job.source}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section>
          {selected ? (
            <article>
              <div className="font-mono text-[11px] text-[#6b6256]">{selected.source}</div>
              <h2 className="font-serif text-3xl">{selected.title}</h2>
              <div className="font-mono text-[11px] text-[#6b6256]">
                {selected.company} · {selected.location}
              </div>
              <div className="my-3 flex flex-wrap gap-2">
                {selected.url ? (
                  <Button asChild className="rounded-none bg-[#1b1712] text-[#f3ead8] uppercase font-mono text-xs">
                    <a href={selected.url} target="_blank" rel="noreferrer">
                      Open listing
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" className="rounded-none border-[#1b1712] uppercase font-mono text-xs" onClick={() => setJobStatus(selected.id, "saved")}>
                  Save
                </Button>
                <Button variant="outline" className="rounded-none border-[#1b1712] uppercase font-mono text-xs" onClick={() => setJobStatus(selected.id, "dismissed")}>
                  Dismiss
                </Button>
              </div>
              <p className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-dashed border-[#c9bba0] pt-3 text-sm leading-relaxed">
                {(selected.description || "").slice(0, 1800)}
              </p>
            </article>
          ) : (
            <article className="text-[#6b6256]">
              <h2 className="font-serif text-3xl text-[#1b1712]">Select an opening</h2>
              <p>Click a listing to read it and draft screening answers against that role.</p>
            </article>
          )}
        </section>
      </div>

      <section className="pt-5">
        <h2 className="font-serif text-2xl">Screening copilot</h2>
        <p className="text-sm text-[#6b6256]">
          Heuristics handle CTC, notice period, and years-per-skill. Optional OPENAI_API_KEY for qualitative prompts.
        </p>
        <form className="mt-3" onSubmit={draft}>
          <label className="text-sm" htmlFor="question">
            Recruiter question
          </label>
          <Textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Years of experience in Docker? Why this role?"
            className="mt-1 rounded-none bg-[#fffaf0] border-[#c9bba0]"
            required
          />
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" className="rounded-none bg-[#1b1712] text-[#f3ead8] uppercase font-mono text-xs">
              Draft answer
            </Button>
            <span className="text-sm text-[#6b6256]">{meta}</span>
          </div>
        </form>
        {answer ? <pre className="mt-3 whitespace-pre-wrap border border-[#1b1712] bg-[#fffaf0] p-3">{answer}</pre> : null}
      </section>
    </div>
  );
}
