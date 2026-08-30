import { solveQuestion } from "@/lib/solver";
import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const question = String(body.question || "").trim();
  if (!question) {
    return NextResponse.json({ detail: "question is required" }, { status: 400 });
  }
  let job = {
    title: body.job_title as string | undefined,
    company: body.job_company as string | undefined,
    description: body.job_description as string | undefined,
  };
  if (body.job_id) {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("jobwire_jobs")
      .select("title, company, description")
      .eq("id", body.job_id)
      .maybeSingle();
    if (data) job = data;
  }
  const result = await solveQuestion(question, job);
  return NextResponse.json({ ...result, question });
}
