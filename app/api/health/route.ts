import { NextResponse } from "next/server";

/**
 * GET /api/health — used by the dashboard topbar / monitoring.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
