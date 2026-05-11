import { NextRequest, NextResponse } from "next/server";
import { getMetaStatus, listMetaAdAccounts } from "@/lib/services/meta-ads";
import { resolveUserId } from "@/app/api/social/meta/_auth";

export async function GET(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const status = await getMetaStatus(userId);
    if (!status.connected) return NextResponse.json(status);

    const accounts = await listMetaAdAccounts(userId).catch(() => []);
    return NextResponse.json({
      ...status,
      adAccountsCount: accounts.length,
      adAccounts: accounts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed_to_fetch_meta_status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
