import { NextResponse } from "next/server";

// Stub: WhatsApp not configured yet. Returns disconnected status so the UI
// shows the "Connect" call-to-action.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "status") {
    return NextResponse.json({ connected: false });
  }
  if (action === "onboarding") {
    return NextResponse.json({ phoneType: null, dmPolicy: "pairing", allowFrom: [] });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.action === "onboarding") {
    // Echo back — no persistence yet.
    return NextResponse.json({ ok: true });
  }
  if (body?.action === "qr") {
    return NextResponse.json({
      sessionId: "stub",
      qrDataUrl: null,
      message: "WhatsApp integration coming soon. Configure WHATSAPP_* env vars to enable.",
    });
  }
  if (body?.action === "disconnect") {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
