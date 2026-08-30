import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const source = String(body.source || "").toLowerCase();
  const title = String(body.title || "").trim();
  const url = String(body.url || "").trim();
  if (!["linkedin", "naukri"].includes(source)) {
    return NextResponse.json({ detail: "source must be linkedin or naukri" }, { status: 400 });
  }
  if (!title || !url) {
    return NextResponse.json({ detail: "title and url are required" }, { status: 400 });
  }
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return NextResponse.json({ detail: "url must be a full http(s) link" }, { status: 400 });
  }
  if (source === "linkedin" && !host.endsWith("linkedin.com")) {
    return NextResponse.json({ detail: "LinkedIn listings must use a linkedin.com URL" }, { status: 400 });
  }
  if (source === "naukri" && !host.endsWith("naukri.com")) {
    return NextResponse.json({ detail: "Naukri listings must use a naukri.com URL" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobwire_jobs")
    .insert({
      source,
      external_id: url,
      title,
      company: String(body.company || "").trim() || null,
      location: String(body.location || "").trim() || null,
      url,
      description: String(body.description || "").trim() || null,
      tags: [source, "manual"],
      posted_at: new Date().toISOString(),
      status: body.applied ? "saved" : "new",
    })
    .select()
    .maybeSingle();

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}
