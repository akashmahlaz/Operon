import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getActiveWorkspaceFiles,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  formatWorkspaceFilesSection,
  type WorkspaceFileKind,
} from "@/lib/services/workspace-files";

async function userIdOf(): Promise<string> {
  const session = await auth();
  if (!session?.user) return "anon";
  return (session.user as { id?: string }).id || session.user.email || "anon";
}

export async function GET() {
  const userId = await userIdOf();
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const files = await getActiveWorkspaceFiles(userId);
  return NextResponse.json({ files, formatted: formatWorkspaceFilesSection(files) });
}

export async function POST(req: Request) {
  const userId = await userIdOf();
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const kind: WorkspaceFileKind | undefined = body?.kind;
  const content: string | undefined = body?.content;
  if (!kind || !["bootstrap", "soul", "user"].includes(kind)) {
    return NextResponse.json({ error: "kind must be bootstrap | soul | user" }, { status: 400 });
  }
  if (typeof content !== "string") {
    return NextResponse.json({ error: "content string required" }, { status: 400 });
  }
  const file = await saveWorkspaceFile(userId, kind, content);
  return NextResponse.json({ file });
}

export async function DELETE(req: Request) {
  const userId = await userIdOf();
  if (userId === "anon") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") as WorkspaceFileKind | null;
  if (!kind || !["bootstrap", "soul", "user"].includes(kind)) {
    return NextResponse.json({ error: "kind must be bootstrap | soul | user" }, { status: 400 });
  }
  await deleteWorkspaceFile(userId, kind);
  return NextResponse.json({ ok: true });
}