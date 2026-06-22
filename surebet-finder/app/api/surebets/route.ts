import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("surebets")
    .select(
      `
      id,
      profit_percent,
      market,
      detected_at,
      details,
      events ( home_team, away_team, commence_time, sport_key )
    `
    )
    .eq("is_active", true)
    .order("detected_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ surebets: data });
}
