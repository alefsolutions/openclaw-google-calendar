import type { CreateCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type { CalendarAttendee, CalendarDateTimeValue } from "../../domain/calendar-event.js";
import type { ClarificationItem, UseCaseResult } from "../../domain/clarification.js";
import { blocked, needsClarification, ready } from "../../domain/clarification.js";

export interface CreateCalendarEventInput {
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarDateTimeValue;
  end?: CalendarDateTimeValue;
  attendees?: CalendarAttendee[];
}

export function prepareCreateCalendarEvent(
  input: CreateCalendarEventInput,
  config: ResolvedGoogleCalendarPluginConfig,
): UseCaseResult<CreateCalendarEventCommand> {
  if (config.readOnlyMode) {
    return blocked("The plugin is in read-only mode, so it cannot create events.");
  }

  // We collect missing details first so the caller can ask one clear follow-up
  // question instead of failing later in the flow.
  const clarificationItems: ClarificationItem[] = [];

  if (isBlank(input.summary)) {
    clarificationItems.push({
      field: "summary" as const,
      question: "What should the event title be?",
      reason: "A new calendar event needs a title or summary.",
    });
  }

  if (!hasCalendarDate(input.start)) {
    clarificationItems.push({
      field: "start" as const,
      question: "When should the event start?",
      reason: "A start date or date-time is required to create the event.",
    });
  }

  if (!hasCalendarDate(input.end)) {
    clarificationItems.push({
      field: "end" as const,
      question: "When should the event end?",
      reason: "An end date or date-time is required to create the event.",
    });
  }

  if (clarificationItems.length > 0) {
    return needsClarification(clarificationItems);
  }

  const command: CreateCalendarEventCommand = {
    calendarId: normalizeOptionalString(input.calendarId) ?? config.defaultCalendarId,
    summary: input.summary!.trim(),
    description: normalizeOptionalString(input.description),
    location: normalizeOptionalString(input.location),
    start: normalizeDateTimeValue(input.start!),
    end: normalizeDateTimeValue(input.end!),
    attendees: normalizeAttendees(input.attendees),
  };

  if (hasComparableDateTimes(command.start, command.end)) {
    const startTime = Date.parse(command.start.dateTime!);
    const endTime = Date.parse(command.end.dateTime!);

    if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime <= startTime) {
      return blocked("The event end time must be after the start time.");
    }
  }

  return ready(command);
}

function hasCalendarDate(value: CalendarDateTimeValue | undefined): boolean {
  if (!value) {
    return false;
  }

  return !isBlank(value.date) || !isBlank(value.dateTime);
}

function hasComparableDateTimes(
  start: CalendarDateTimeValue,
  end: CalendarDateTimeValue,
): boolean {
  return !isBlank(start.dateTime) && !isBlank(end.dateTime);
}

function normalizeDateTimeValue(value: CalendarDateTimeValue): CalendarDateTimeValue {
  return {
    date: normalizeOptionalString(value.date),
    dateTime: normalizeOptionalString(value.dateTime),
    timeZone: normalizeOptionalString(value.timeZone),
  };
}

function normalizeAttendees(
  attendees: CalendarAttendee[] | undefined,
): CalendarAttendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  const cleanedAttendees = attendees
    .map((attendee) => ({
      email: attendee.email.trim(),
      displayName: normalizeOptionalString(attendee.displayName),
      responseStatus: attendee.responseStatus,
    }))
    .filter((attendee) => attendee.email.length > 0);

  return cleanedAttendees.length > 0 ? cleanedAttendees : undefined;
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return isBlank(value) ? undefined : value!.trim();
}
