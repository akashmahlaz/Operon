import { NextRequest, NextResponse } from "next/server";
import { listMetaCampaigns } from "@/lib/services/meta-ads";
import { resolveUserId } from "@/app/api/social/meta/_auth";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const adAccountId = url.searchParams.get("adAccountId")?.trim();
  const limitRaw = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;

  if (!adAccountId) {
    return NextResponse.json({ error: "missing_ad_account_id" }, { status: 400 });
  }

  try {
    const campaigns = await listMetaCampaigns(userId, adAccountId, limit);
    return NextResponse.json({ campaigns });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_fetch_campaigns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
