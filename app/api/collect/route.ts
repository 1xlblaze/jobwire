import { collectAll } from "@/lib/collector";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const results = await collectAll();
  return NextResponse.json({ results });
}

export async function POST() {
  const results = await collectAll();
  return NextResponse.json({ results });
}
