import type { UpdateCalendarEventCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type {
  CalendarEventPatch,
  CalendarEventReference,
} from "../../domain/calendar-event.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import {
  blocked,
  needsClarification,
  needsConfirmation,
  ready,
} from "../../domain/clarification.js";
import {
  compareNormalizedCalendarDateTimes,
  normalizeCalendarDateTimeValue,
} from "../../shared/calendar-date-time.js";

export interface UpdateCalendarEventInput {
  reference?: CalendarEventReference;
  changes?: CalendarEventPatch;
  confirmed?: boolean;
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

  const normalizedChanges = normalizePatch(input.changes, config.defaultTimeZone);

  if (normalizedChanges.status === "invalid") {
    return blocked(normalizedChanges.reason);
  }

  if (normalizedChanges.status === "missing") {
    return needsClarification([
      {
        field: "updatePayload",
        question: "What should change on the event?",
        reason: "An update request needs at least one concrete field to change.",
      },
    ]);
  }

  if (normalizedChanges.value.start && normalizedChanges.value.end) {
    const normalizedStart = normalizeCalendarDateTimeValue(normalizedChanges.value.start, {
      defaultTimeZone: config.defaultTimeZone,
      fieldLabel: "updated start",
    });
    const normalizedEnd = normalizeCalendarDateTimeValue(normalizedChanges.value.end, {
      defaultTimeZone: config.defaultTimeZone,
      fieldLabel: "updated end",
    });

    if (normalizedStart.status === "invalid") {
      return blocked(normalizedStart.reason);
    }

    if (normalizedEnd.status === "invalid") {
      return blocked(normalizedEnd.reason);
    }

    if (normalizedStart.status !== "valid" || normalizedEnd.status !== "valid") {
      return blocked(
        "Updated start and end must both be provided when changing event timing.",
      );
    }

    const dateTimeComparison = compareNormalizedCalendarDateTimes(
      normalizedStart.value,
      normalizedEnd.value,
    );

    if (dateTimeComparison === null) {
      return blocked(
        "Updated start and end must both be all-day values or both be timed values in a compatible format.",
      );
    }

    if (dateTimeComparison >= 0) {
      return blocked("The updated end time must be after the updated start time.");
    }
  }

  if (requiresUpdateConfirmation(input, config) && input.confirmed !== true) {
    return needsConfirmation(
      'Please confirm this calendar event update by re-running the tool with "confirmed": true.',
    );
  }

  return ready({
    reference: normalizeReference(input.reference!),
    changes: normalizedChanges.value,
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

function normalizePatch(
  changes: CalendarEventPatch | undefined,
  defaultTimeZone: string | undefined,
):
  | {
      status: "missing";
    }
  | {
      status: "invalid";
      reason: string;
    }
  | {
      status: "valid";
      value: CalendarEventPatch;
    } {
  if (!changes) {
    return {
      status: "missing",
    };
  }

  const normalizedStart = normalizeCalendarDateTimeValue(changes.start, {
    defaultTimeZone,
    fieldLabel: "updated start",
  });
  const normalizedEnd = normalizeCalendarDateTimeValue(changes.end, {
    defaultTimeZone,
    fieldLabel: "updated end",
  });

  if (normalizedStart.status === "invalid") {
    return normalizedStart;
  }

  if (normalizedEnd.status === "invalid") {
    return normalizedEnd;
  }

  const normalizedPatch: CalendarEventPatch = {
    summary: normalizeOptionalString(changes.summary),
    description: normalizeOptionalString(changes.description),
    location: normalizeOptionalString(changes.location),
    start: normalizedStart.status === "valid" ? normalizedStart.value.value : undefined,
    end: normalizedEnd.status === "valid" ? normalizedEnd.value.value : undefined,
    attendees: normalizeAttendees(changes.attendees),
  };

  if (!hasPatchContent(normalizedPatch)) {
    return {
      status: "missing",
    };
  }

  return {
    status: "valid",
    value: normalizedPatch,
  };
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

function requiresUpdateConfirmation(
  input: UpdateCalendarEventInput,
  config: ResolvedGoogleCalendarPluginConfig,
): boolean {
  if (config.confirmationMode === "always") {
    return true;
  }

  if (config.confirmationMode !== "when-ambiguous") {
    return false;
  }

  return Boolean(input.reference && isBlank(input.reference.eventId));
}
