import type { GetCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { CalendarEventReference } from "../../domain/calendar-event.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import { needsClarification, ready } from "../../domain/clarification.js";

export interface GetCalendarEventInput {
  reference?: CalendarEventReference;
}

export function prepareGetCalendarEvent(
  input: GetCalendarEventInput,
): UseCaseResult<GetCalendarEventCommand> {
  if (!hasReference(input.reference)) {
    return needsClarification([
      {
        field: "eventReference",
        question: "Which calendar event should I look up?",
        reason: "The plugin needs an event id or a clear event reference.",
      },
    ]);
  }

  return ready({
    reference: normalizeReference(input.reference!),
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

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return isBlank(value) ? undefined : value!.trim();
}
