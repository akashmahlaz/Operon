/**
 * Google Calendar service. Uses the operator's connected Google OAuth token
 * (provider="google") via `resolveProviderKey`.
 */

import { resolveProviderKey } from "@/lib/services/auth-profiles";
import { notConnectedError } from "@/lib/services/tool-errors";

const CAL_API = "https://www.googleapis.com/calendar/v3";

async function token(userId: string): Promise<string> {
  const tk = await resolveProviderKey("google", userId);
  if (!tk) throw notConnectedError("google", "Google");
  return tk;
}

async function calFetch<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const tk = await token(userId);
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${tk}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${CAL_API}${path}`, { ...init, headers });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!res.ok) {
    const msg = (json?.error as { message?: string })?.message || res.statusText;
    throw new Error(`Google Calendar ${res.status}: ${msg}`);
  }
  return json as T;
}

export async function getCalendarStatus(userId: string) {
  try {
    const tk = await resolveProviderKey("google", userId);
    if (!tk) return { connected: false };
    const me = await calFetch<{ items?: unknown[] }>(userId, "/users/me/calendarList?maxResults=1");
    return { connected: true, hasCalendars: (me.items?.length ?? 0) > 0 };
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listCalendars(userId: string) {
  return calFetch<{ items: Array<{ id: string; summary: string; primary?: boolean; accessRole: string }> }>(
    userId,
    "/users/me/calendarList",
  );
}

export async function listEvents(userId: string, params: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  q?: string;
  maxResults?: number;
}) {
  const cal = encodeURIComponent(params.calendarId ?? "primary");
  const qs = new URLSearchParams({ singleEvents: "true", orderBy: "startTime" });
  if (params.timeMin) qs.set("timeMin", params.timeMin);
  if (params.timeMax) qs.set("timeMax", params.timeMax);
  if (params.q) qs.set("q", params.q);
  if (params.maxResults) qs.set("maxResults", String(params.maxResults));
  return calFetch<{ items: unknown[] }>(userId, `/calendars/${cal}/events?${qs.toString()}`);
}

export async function createCalendarEvent(userId: string, params: {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO
  end: string; // ISO
  attendees?: string[];
  timeZone?: string;
}) {
  const cal = encodeURIComponent(params.calendarId ?? "primary");
  const body = {
    summary: params.summary,
    description: params.description,
    location: params.location,
    start: { dateTime: params.start, timeZone: params.timeZone },
    end: { dateTime: params.end, timeZone: params.timeZone },
    attendees: params.attendees?.map((email) => ({ email })),
  };
  return calFetch<{ id: string; htmlLink: string }>(userId, `/calendars/${cal}/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateCalendarEvent(userId: string, calendarId: string, eventId: string, patch: Record<string, unknown>) {
  return calFetch<unknown>(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

export async function deleteCalendarEvent(userId: string, calendarId: string, eventId: string) {
  await calFetch<unknown>(
    userId,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  return { deleted: true, eventId };
}

export async function findFreeSlots(userId: string, params: {
  calendarIds?: string[];
  timeMin: string;
  timeMax: string;
  timeZone?: string;
}) {
  const body = {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    timeZone: params.timeZone,
    items: (params.calendarIds ?? ["primary"]).map((id) => ({ id })),
  };
  return calFetch<{ calendars: Record<string, { busy: Array<{ start: string; end: string }> }> }>(
    userId,
    "/freeBusy",
    { method: "POST", body: JSON.stringify(body) },
  );
}
