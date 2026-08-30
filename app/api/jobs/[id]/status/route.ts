import { getSupabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = await request.json();
  const status = body.status as string;
  if (!["new", "saved", "dismissed"].includes(status)) {
    return NextResponse.json({ detail: "invalid status" }, { status: 400 });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("jobwire_jobs")
    .update({ status })
    .eq("id", Number(id))
    .select()
    .maybeSingle();
  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}
