import { resolveProviderKey, upsertAuthProfile } from "@/lib/services/auth-profiles";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

async function gmailFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Gmail API ${response.status}: ${text || response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function validateAndStoreGoogleToken(userId: string, token: string) {
  const profile = await gmailFetch<{ emailAddress: string; messagesTotal: number; threadsTotal: number }>(
    token,
    "/users/me/profile",
  );
  await upsertAuthProfile({
    userId,
    provider: "google",
    type: "oauth",
    token,
    metadata: { email: profile.emailAddress, messagesTotal: profile.messagesTotal },
  });
  return { profile };
}

export async function getGmailStatus(userId: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) return { connected: false as const };
  const profile = await gmailFetch<{ emailAddress: string }>(token, "/users/me/profile");
  return { connected: true as const, email: profile.emailAddress };
}

export async function listGmailLabels(userId: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const data = await gmailFetch<{ labels: Array<{ id: string; name: string; type: string }> }>(token, "/users/me/labels");
  return data.labels ?? [];
}

export async function searchGmail(userId: string, query: string, maxResults = 10) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const list = await gmailFetch<{ messages?: Array<{ id: string; threadId: string }> }>(
    token,
    `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
  );
  const ids = (list.messages ?? []).slice(0, maxResults);
  const messages = await Promise.all(
    ids.map((m) =>
      gmailFetch<{
        id: string;
        threadId: string;
        snippet: string;
        payload: { headers: Array<{ name: string; value: string }> };
        internalDate: string;
      }>(token, `/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );
  return messages.map((m) => {
    const headers = Object.fromEntries(m.payload.headers.map((h) => [h.name.toLowerCase(), h.value]));
    return {
      id: m.id,
      threadId: m.threadId,
      snippet: m.snippet,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      date: headers.date,
      internalDate: m.internalDate,
    };
  });
}

function decodeBase64Url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function extractPlainText(payload: GmailPart): string {
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

export async function readGmailMessage(userId: string, messageId: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const message = await gmailFetch<{
    id: string;
    threadId: string;
    snippet: string;
    payload: GmailPart & { headers: Array<{ name: string; value: string }> };
    internalDate: string;
  }>(token, `/users/me/messages/${encodeURIComponent(messageId)}?format=full`);
  const headers = Object.fromEntries(message.payload.headers.map((h) => [h.name.toLowerCase(), h.value]));
  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet,
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    subject: headers.subject,
    date: headers.date,
    body: extractPlainText(message.payload),
  };
}

function buildRawEmail({ to, subject, body, cc, bcc, replyToMessageId, replyReferences }: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  replyToMessageId?: string;
  replyReferences?: string;
}) {
  const lines = [
    `To: ${to}`,
    cc ? `Cc: ${cc}` : "",
    bcc ? `Bcc: ${bcc}` : "",
    `Subject: ${subject}`,
    replyToMessageId ? `In-Reply-To: ${replyToMessageId}` : "",
    replyReferences ? `References: ${replyReferences}` : "",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].filter(Boolean);
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(userId: string, input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const raw = buildRawEmail(input);
  return gmailFetch<{ id: string; threadId: string }>(token, "/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
}

export async function createGmailDraft(userId: string, input: { to: string; subject: string; body: string; cc?: string; bcc?: string }) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const raw = buildRawEmail(input);
  return gmailFetch<{ id: string; message: { id: string; threadId: string } }>(token, "/users/me/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });
}

export async function replyToGmail(userId: string, input: { messageId: string; body: string }) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  const original = await readGmailMessage(userId, input.messageId);
  const subject = original.subject?.startsWith("Re:") ? original.subject : `Re: ${original.subject ?? ""}`;
  const raw = buildRawEmail({
    to: original.from ?? "",
    subject,
    body: input.body,
    replyToMessageId: original.id,
  });
  return gmailFetch<{ id: string; threadId: string }>(token, "/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, threadId: original.threadId }),
  });
}

export async function modifyGmailLabels(userId: string, messageId: string, addLabelIds: string[] = [], removeLabelIds: string[] = []) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  return gmailFetch<unknown>(token, `/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function trashGmailMessage(userId: string, messageId: string) {
  const token = await resolveProviderKey("google", userId);
  if (!token) throw new Error("Google token not configured");
  return gmailFetch<unknown>(token, `/users/me/messages/${encodeURIComponent(messageId)}/trash`, { method: "POST" });
}
