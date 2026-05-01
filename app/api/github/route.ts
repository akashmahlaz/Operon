import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateAndStoreGitHubToken, getGitHubStatus, listGitHubRepos, listGitHubRepoContents } from "@/lib/services/github";
import { removeAuthProfile } from "@/lib/services/auth-profiles";
import { appendLog } from "@/lib/services/logs";

async function userIdOf(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "anon";
  return (session.user as { id?: string }).id || session.user.email || "anon";
}

export async function GET(req: Request) {
  const userId = await userIdOf();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";

  try {
    if (action === "status") {
      return NextResponse.json(await getGitHubStatus(userId));
    }
    if (action === "repos") {
      const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get("perPage") || 30)));
      return NextResponse.json({ repos: await listGitHubRepos(userId, perPage) });
    }
    if (action === "contents") {
      const owner = url.searchParams.get("owner");
      const repo = url.searchParams.get("repo");
      if (!owner || !repo) return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
      const path = url.searchParams.get("path") || "";
      const ref = url.searchParams.get("ref") || undefined;
      return NextResponse.json({ contents: await listGitHubRepoContents(userId, owner, repo, path, ref) });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub request failed" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const userId = await userIdOf();
  const body = await req.json().catch(() => ({}));
  const action = typeof body?.action === "string" ? body.action : "connect";

  try {
    if (action === "disconnect") {
      await removeAuthProfile(userId, "github:api_key");
      await appendLog({ userId, level: "info", source: "github", message: "GitHub disconnected" });
      return NextResponse.json({ ok: true });
    }

    const token = String(body?.token || "").trim();
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
    const result = await validateAndStoreGitHubToken(userId, token);
    await appendLog({ userId, level: "info", source: "github", message: "GitHub connected", metadata: { login: result.viewer.login, repos: result.repos.length } });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await appendLog({ userId, level: "error", source: "github", message: "GitHub connection failed", metadata: { error: error instanceof Error ? error.message : String(error) } });
    return NextResponse.json({ error: error instanceof Error ? error.message : "GitHub connection failed" }, { status: 502 });
  }
}
