import { NextRequest, NextResponse } from "next/server";
import { getMetaCampaignInsights } from "@/lib/services/meta-ads";
import { resolveUserId } from "@/app/api/social/meta/_auth";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const campaignId = url.searchParams.get("campaignId")?.trim();
  const datePreset = url.searchParams.get("datePreset")?.trim() || "last_7d";

  if (!campaignId) {
    return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });
  }

  try {
    const insights = await getMetaCampaignInsights(userId, campaignId, datePreset);
    return NextResponse.json({ insights });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_fetch_insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
