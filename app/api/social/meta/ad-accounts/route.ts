import { NextRequest, NextResponse } from "next/server";
import { listMetaAdAccounts } from "@/lib/services/meta-ads";
import { resolveUserId } from "@/app/api/social/meta/_auth";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const accounts = await listMetaAdAccounts(userId);
    return NextResponse.json({ accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_fetch_ad_accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
