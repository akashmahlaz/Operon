import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  if (action === "status") {
    return NextResponse.json({ connected: false });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
