import type { calendar_v3 } from "googleapis";

import type {
  CalendarAttendee,
  CalendarDateTimeValue,
  CalendarEvent,
  CalendarEventPatch,
} from "../../domain/calendar-event.js";
import type { CreateCalendarEventCommand } from "../../application/ports/calendar-gateway.js";

export function mapGoogleEventToDomainEvent(
  event: calendar_v3.Schema$Event,
  calendarId: string,
): CalendarEvent {
  return {
    id: event.id ?? "",
    calendarId,
    summary: normalizeOptionalString(event.summary) ?? "(Untitled event)",
    description: normalizeOptionalString(event.description),
    location: normalizeOptionalString(event.location),
    start: mapGoogleDateTimeToDomainDateTime(event.start),
    end: mapGoogleDateTimeToDomainDateTime(event.end),
    attendees: mapGoogleAttendeesToDomainAttendees(event.attendees),
    status: normalizeEventStatus(event.status),
    htmlLink: normalizeOptionalString(event.htmlLink),
  };
}

export function mapCreateCommandToGoogleEvent(
  command: CreateCalendarEventCommand,
): calendar_v3.Schema$Event {
  return {
    summary: command.summary,
    description: command.description,
    location: command.location,
    start: mapDomainDateTimeToGoogleDateTime(command.start),
    end: mapDomainDateTimeToGoogleDateTime(command.end),
    attendees: mapDomainAttendeesToGoogleAttendees(command.attendees),
  };
}

export function mapEventPatchToGoogleEvent(
  changes: CalendarEventPatch,
): calendar_v3.Schema$Event {
  return {
    summary: changes.summary,
    description: changes.description,
    location: changes.location,
    start: mapOptionalDomainDateTimeToGoogleDateTime(changes.start),
    end: mapOptionalDomainDateTimeToGoogleDateTime(changes.end),
    attendees: mapDomainAttendeesToGoogleAttendees(changes.attendees),
  };
}

function mapGoogleDateTimeToDomainDateTime(
  value: calendar_v3.Schema$EventDateTime | undefined | null,
): CalendarDateTimeValue {
  return {
    date: normalizeOptionalString(value?.date ?? undefined),
    dateTime: normalizeOptionalString(value?.dateTime ?? undefined),
    timeZone: normalizeOptionalString(value?.timeZone ?? undefined),
  };
}

function mapDomainDateTimeToGoogleDateTime(
  value: CalendarDateTimeValue,
): calendar_v3.Schema$EventDateTime {
  return {
    date: value.date,
    dateTime: value.dateTime,
    timeZone: value.timeZone,
  };
}

function mapOptionalDomainDateTimeToGoogleDateTime(
  value: CalendarDateTimeValue | undefined,
): calendar_v3.Schema$EventDateTime | undefined {
  if (!value) {
    return undefined;
  }

  return mapDomainDateTimeToGoogleDateTime(value);
}

function mapGoogleAttendeesToDomainAttendees(
  attendees: calendar_v3.Schema$EventAttendee[] | undefined,
): CalendarAttendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  const mappedAttendees = attendees
    .map((attendee) => ({
      email: normalizeOptionalString(attendee.email) ?? "",
      displayName: normalizeOptionalString(attendee.displayName),
      responseStatus: normalizeResponseStatus(attendee.responseStatus),
    }))
    .filter((attendee) => attendee.email.length > 0);

  return mappedAttendees.length > 0 ? mappedAttendees : undefined;
}

function mapDomainAttendeesToGoogleAttendees(
  attendees: CalendarAttendee[] | undefined,
): calendar_v3.Schema$EventAttendee[] | undefined {
  if (!attendees || attendees.length === 0) {
    return undefined;
  }

  return attendees.map((attendee) => ({
    email: attendee.email,
    displayName: attendee.displayName,
    responseStatus: attendee.responseStatus,
  }));
}

function normalizeEventStatus(
  status: string | null | undefined,
): CalendarEvent["status"] | undefined {
  if (status === "confirmed" || status === "tentative" || status === "cancelled") {
    return status;
  }

  return undefined;
}

function normalizeResponseStatus(
  status: string | null | undefined,
): CalendarAttendee["responseStatus"] | undefined {
  if (
    status === "needsAction" ||
    status === "accepted" ||
    status === "declined" ||
    status === "tentative"
  ) {
    return status;
  }

  return undefined;
}

function normalizeOptionalString(value: string | undefined | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}
