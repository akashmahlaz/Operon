import { NextRequest, NextResponse } from "next/server";
import { appendLog } from "@/lib/services/logs";
import { pauseMetaCampaign, resumeMetaCampaign } from "@/lib/services/meta-ads";
import { resolveUserId } from "@/app/api/social/meta/_auth";

interface CampaignActionBody {
  campaignId?: string;
  action?: "pause" | "resume";
}

export async function POST(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: CampaignActionBody;
  try {
    body = (await req.json()) as CampaignActionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const campaignId = body.campaignId?.trim();
  const action = body.action;

  if (!campaignId) return NextResponse.json({ error: "missing_campaign_id" }, { status: 400 });
  if (action !== "pause" && action !== "resume") {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  try {
    const output = action === "pause"
      ? await pauseMetaCampaign(userId, campaignId)
      : await resumeMetaCampaign(userId, campaignId);

    await appendLog({
      userId,
      level: "info",
      source: "social-meta",
      message: `Campaign ${action}d`,
      metadata: { campaignId, action },
    });

    return NextResponse.json({ ok: true, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_update_campaign";
    await appendLog({
      userId,
      level: "warn",
      source: "social-meta",
      message: "Campaign action failed",
      metadata: { campaignId, action, error: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
