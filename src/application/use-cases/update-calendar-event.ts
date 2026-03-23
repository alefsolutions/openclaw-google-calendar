import type { UpdateCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type {
  CalendarDateTimeValue,
  CalendarEventPatch,
  CalendarEventReference,
} from "../../domain/calendar-event.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import { blocked, needsClarification, ready } from "../../domain/clarification.js";

export interface UpdateCalendarEventInput {
  reference?: CalendarEventReference;
  changes?: CalendarEventPatch;
}

export function prepareUpdateCalendarEvent(
  input: UpdateCalendarEventInput,
  config: ResolvedGoogleCalendarPluginConfig,
): UseCaseResult<UpdateCalendarEventCommand> {
  if (config.readOnlyMode) {
    return blocked("The plugin is in read-only mode, so it cannot update events.");
  }

  if (!hasReference(input.reference)) {
    return needsClarification([
      {
        field: "eventReference",
        question: "Which event should be updated?",
        reason: "The plugin needs a specific event reference before it can update anything.",
      },
    ]);
  }

  const normalizedChanges = normalizePatch(input.changes);

  if (!normalizedChanges) {
    return needsClarification([
      {
        field: "updatePayload",
        question: "What should change on the event?",
        reason: "An update request needs at least one concrete field to change.",
      },
    ]);
  }

  if (hasComparableDateTimes(normalizedChanges.start, normalizedChanges.end)) {
    const startTime = Date.parse(normalizedChanges.start!.dateTime!);
    const endTime = Date.parse(normalizedChanges.end!.dateTime!);

    if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime <= startTime) {
      return blocked("The updated end time must be after the updated start time.");
    }
  }

  return ready({
    reference: normalizeReference(input.reference!),
    changes: normalizedChanges,
  });
}

function hasReference(reference: CalendarEventReference | undefined): boolean {
  if (!reference) {
    return false;
  }

  return (
    !isBlank(reference.eventId) ||
    !isBlank(reference.summaryHint) ||
    !isBlank(reference.startHint)
  );
}

function normalizeReference(reference: CalendarEventReference): CalendarEventReference {
  return {
    eventId: normalizeOptionalString(reference.eventId),
    summaryHint: normalizeOptionalString(reference.summaryHint),
    startHint: normalizeOptionalString(reference.startHint),
    calendarId: normalizeOptionalString(reference.calendarId),
  };
}

function normalizePatch(changes: CalendarEventPatch | undefined): CalendarEventPatch | undefined {
  if (!changes) {
    return undefined;
  }

  const normalizedPatch: CalendarEventPatch = {
    summary: normalizeOptionalString(changes.summary),
    description: normalizeOptionalString(changes.description),
    location: normalizeOptionalString(changes.location),
    start: normalizeDateTimeValue(changes.start),
    end: normalizeDateTimeValue(changes.end),
    attendees: normalizeAttendees(changes.attendees),
  };

  return hasPatchContent(normalizedPatch) ? normalizedPatch : undefined;
}

function hasPatchContent(changes: CalendarEventPatch): boolean {
  return Boolean(
    changes.summary ||
      changes.description ||
      changes.location ||
      changes.start ||
      changes.end ||
      (changes.attendees && changes.attendees.length > 0),
  );
}

function hasComparableDateTimes(
  start: CalendarDateTimeValue | undefined,
  end: CalendarDateTimeValue | undefined,
): boolean {
  return Boolean(start?.dateTime && end?.dateTime);
}

function normalizeDateTimeValue(
  value: CalendarDateTimeValue | undefined,
): CalendarDateTimeValue | undefined {
  if (!value) {
    return undefined;
  }

  const normalizedValue = {
    date: normalizeOptionalString(value.date),
    dateTime: normalizeOptionalString(value.dateTime),
    timeZone: normalizeOptionalString(value.timeZone),
  };

  return normalizedValue.date || normalizedValue.dateTime ? normalizedValue : undefined;
}

function normalizeAttendees(attendees: CalendarEventPatch["attendees"]): CalendarEventPatch["attendees"] {
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
