import { tool } from "ai";
import { z } from "zod";
import { appendLog } from "@/lib/services/logs";
import { requireConfirmation } from "@/lib/ai/tools/confirm";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  findFreeSlots,
  getCalendarStatus,
  listCalendars,
  listEvents,
  updateCalendarEvent,
} from "@/lib/services/calendar";

export function createCalendarTools(userId: string) {
  return {
    calendar_get_status: tool({
      description: "Check whether Google Calendar is connected.",
      inputSchema: z.object({}),
      execute: async () => getCalendarStatus(userId),
    }),
    calendar_list_calendars: tool({
      description: "List all calendars the operator has access to.",
      inputSchema: z.object({}),
      execute: async () => listCalendars(userId),
    }),
    calendar_list_events: tool({
      description: "List upcoming events. Provide ISO timeMin/timeMax (default: now → +14d).",
      inputSchema: z.object({
        calendarId: z.string().optional().describe("Default 'primary'."),
        timeMin: z.string().optional(),
        timeMax: z.string().optional(),
        q: z.string().optional(),
        maxResults: z.number().int().min(1).max(250).optional(),
      }),
      execute: async (input) => {
        const now = new Date();
        return listEvents(userId, {
          ...input,
          timeMin: input.timeMin ?? now.toISOString(),
          timeMax: input.timeMax ?? new Date(now.getTime() + 14 * 86400_000).toISOString(),
        });
      },
    }),
    calendar_create_event: tool({
      description: "Create a calendar event. start/end are ISO 8601 strings.",
      inputSchema: z.object({
        calendarId: z.string().optional(),
        summary: z.string().min(1),
        description: z.string().optional(),
        location: z.string().optional(),
        start: z.string(),
        end: z.string(),
        attendees: z.array(z.string().email()).optional(),
        timeZone: z.string().optional(),
      }),
      execute: async (input) => {
        await appendLog({ userId, level: "info", source: "ai-tool", message: "Calendar event created", metadata: { tool: "calendar_create_event", summary: input.summary } });
        return createCalendarEvent(userId, input);
      },
    }),
    calendar_update_event: tool({
      description: "Update a calendar event by id (PATCH).",
      inputSchema: z.object({
        calendarId: z.string(),
        eventId: z.string(),
        patch: z.record(z.string(), z.unknown()),
      }),
      execute: async ({ calendarId, eventId, patch }) =>
        updateCalendarEvent(userId, calendarId, eventId, patch),
    }),
    calendar_delete_event: tool({
      description: "Delete a calendar event. Two-phase confirmation required.",
      inputSchema: z.object({
        calendarId: z.string(),
        eventId: z.string(),
        __confirmToken: z.string().optional(),
      }),
      execute: async ({ calendarId, eventId, __confirmToken }) => {
        const pending = await requireConfirmation({
          userId, tool: "calendar_delete_event", args: { calendarId, eventId },
          summary: `Delete event ${eventId} from calendar ${calendarId}?`,
          confirmToken: __confirmToken,
        });
        if (pending) return pending;
        await appendLog({ userId, level: "warn", source: "ai-tool", message: "Calendar event deleted", metadata: { tool: "calendar_delete_event", calendarId, eventId } });
        return deleteCalendarEvent(userId, calendarId, eventId);
      },
    }),
    calendar_find_free_slots: tool({
      description: "Find busy/free windows across one or more calendars.",
      inputSchema: z.object({
        calendarIds: z.array(z.string()).optional(),
        timeMin: z.string(),
        timeMax: z.string(),
        timeZone: z.string().optional(),
      }),
      execute: async (input) => findFreeSlots(userId, input),
    }),
  };
}
