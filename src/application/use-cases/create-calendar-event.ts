import type { CreateCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type { CalendarAttendee, CalendarDateTimeValue } from "../../domain/calendar-event.js";
import type { ClarificationItem, UseCaseResult } from "../../domain/clarification.js";
import {
  blocked,
  needsClarification,
  needsConfirmation,
  ready,
} from "../../domain/clarification.js";
import {
  compareNormalizedCalendarDateTimes,
  createDefaultCalendarEventEnd,
  normalizeCalendarDateTimeValue,
} from "../../shared/calendar-date-time.js";

export interface CreateCalendarEventInput {
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarDateTimeValue;
  end?: CalendarDateTimeValue;
  attendees?: CalendarAttendee[];
  confirmed?: boolean;
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

  if (clarificationItems.length > 0) {
    return needsClarification(clarificationItems);
  }

  const normalizedStart = normalizeCalendarDateTimeValue(input.start, {
    defaultTimeZone: config.defaultTimeZone,
    fieldLabel: "start",
  });

  if (normalizedStart.status === "invalid") {
    return blocked(normalizedStart.reason);
  }

  if (normalizedStart.status !== "valid") {
    return needsClarification([
      {
        field: "start",
        question: "When should the event start?",
        reason: "A start date or date-time is required to create the event.",
      },
    ]);
  }

  const normalizedEnd = normalizeCalendarDateTimeValue(input.end, {
    defaultTimeZone: config.defaultTimeZone,
    fieldLabel: "end",
  });

  if (normalizedEnd.status === "invalid") {
    return blocked(normalizedEnd.reason);
  }

  const finalEndValue =
    normalizedEnd.status === "valid"
      ? normalizedEnd.value
      : createDefaultCalendarEventEnd(normalizedStart.value);

  const dateTimeComparison = compareNormalizedCalendarDateTimes(
    normalizedStart.value,
    finalEndValue,
  );

  if (dateTimeComparison === null) {
    return blocked(
      "Event start and end must both be all-day values or both be timed values in a compatible format.",
    );
  }

  if (dateTimeComparison >= 0) {
    return blocked("The event end time must be after the start time.");
  }

  if (config.confirmationMode === "always" && input.confirmed !== true) {
    return needsConfirmation(
      'Please confirm this calendar event creation by re-running the tool with "confirmed": true.',
    );
  }

  const command: CreateCalendarEventCommand = {
    calendarId: normalizeOptionalString(input.calendarId) ?? config.defaultCalendarId,
    summary: input.summary!.trim(),
    description: normalizeOptionalString(input.description),
    location: normalizeOptionalString(input.location),
    start: normalizedStart.value.value,
    end: finalEndValue.value,
    attendees: normalizeAttendees(input.attendees),
  };

  return ready(command);
}

function hasCalendarDate(value: CalendarDateTimeValue | undefined): boolean {
  if (!value) {
    return false;
  }

  return !isBlank(value.date) || !isBlank(value.dateTime);
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
