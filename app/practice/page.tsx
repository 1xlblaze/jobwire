"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useState } from "react";

const FIELDS = [
  { id: "docker", label: "Years of experience in Docker?", multiline: false },
  { id: "notice", label: "Notice period", multiline: false },
  { id: "ctc", label: "Expected CTC", multiline: false },
  { id: "why", label: "Why this role?", multiline: true },
];

export default function PracticePage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function suggest(id: string, label: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: label,
          job_title: "Practice Python Developer",
          job_company: "Jobwire Desk",
        }),
      });
      const data = await res.json();
      setValues((current) => ({ ...current, [id]: data.answer || data.detail }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#3a3329] p-4">
      <div className="mx-auto max-w-3xl my-6 border border-[#1b1712] bg-[#f3ead8] p-7 text-[#1b1712] shadow-[8px_10px_0_#1b1712]">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#9c1c12]">
          <Link href="/">← Back to the wire</Link> · Practice form · nothing is submitted
        </p>
        <h1 className="font-serif text-5xl font-bold mt-3">Practice application</h1>
        <p className="mt-3 max-w-[70ch]">
          Stand-in for a careers page. Suggest answer uses the same API as the Chrome helper.
          There is no Apply button that sends data anywhere.
        </p>
        <form className="mt-6 space-y-5" onSubmit={(e) => e.preventDefault()}>
          {FIELDS.map((field) => (
            <p key={field.id}>
              <label className="block text-sm" htmlFor={field.id}>
                {field.label}
              </label>
              {field.multiline ? (
                <Textarea
                  id={field.id}
                  className="mt-1 rounded-none bg-[#fffaf0] border-[#c9bba0]"
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((c) => ({ ...c, [field.id]: e.target.value }))}
                />
              ) : (
                <Input
                  id={field.id}
                  className="mt-1 rounded-none bg-[#fffaf0] border-[#c9bba0]"
                  value={values[field.id] || ""}
                  onChange={(e) => setValues((c) => ({ ...c, [field.id]: e.target.value }))}
                />
              )}
              <Button
                type="button"
                variant="outline"
                className="mt-2 rounded-none border-[#1b1712] uppercase font-mono text-xs"
                disabled={busy === field.id}
                onClick={() => suggest(field.id, field.label)}
              >
                {busy === field.id ? "Drafting…" : "Suggest answer"}
              </Button>
            </p>
          ))}
        </form>
      </div>
    </main>
  );
}
