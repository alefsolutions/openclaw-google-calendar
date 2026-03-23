import type { DeleteCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type { CalendarEventReference } from "../../domain/calendar-event.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import { blocked, needsClarification, ready } from "../../domain/clarification.js";

export interface DeleteCalendarEventInput {
  reference?: CalendarEventReference;
}

export function prepareDeleteCalendarEvent(
  input: DeleteCalendarEventInput,
  config: ResolvedGoogleCalendarPluginConfig,
): UseCaseResult<DeleteCalendarEventCommand> {
  if (config.readOnlyMode) {
    return blocked("The plugin is in read-only mode, so it cannot delete events.");
  }

  if (!hasReference(input.reference)) {
    return needsClarification([
      {
        field: "eventReference",
        question: "Which event should be deleted?",
        reason: "Deletion requires a specific event reference.",
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
