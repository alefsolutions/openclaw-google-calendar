import type {
  CalendarGateway,
  CreateCalendarEventCommand,
  GetCalendarEventCommand,
  ListUpcomingEventsCommand,
  FindNextMeetingCommand,
  UpdateCalendarEventCommand,
  DeleteCalendarEventCommand,
} from "../../application/ports/calendar-gateway.js";
import { NotImplementedYetError } from "../../shared/errors.js";
import type {
  GoogleCalendarClient,
  GoogleCalendarGatewayOptions,
} from "./google-calendar-client.js";
import {
  mapCreateCommandToGoogleEvent,
  mapEventPatchToGoogleEvent,
  mapGoogleEventToDomainEvent,
} from "./google-calendar-event-mapper.js";

// This adapter owns raw Google Calendar API calls. Keeping it here lets the
// use-case layer stay focused on validation and clarification rules.
export function createGoogleCalendarGateway(
  client: GoogleCalendarClient,
  options: GoogleCalendarGatewayOptions = {},
): CalendarGateway {
  const defaultCalendarId = options.defaultCalendarId ?? "primary";

  return {
    async createEvent(command: CreateCalendarEventCommand) {
      const response = await client.events.insert({
        calendarId: command.calendarId,
        requestBody: mapCreateCommandToGoogleEvent(command),
      });

      return mapGoogleEventToDomainEvent(response.data, command.calendarId);
    },

    async getEvent(command: GetCalendarEventCommand) {
      const resolvedReference = resolveEventReference(command.reference, defaultCalendarId);

      try {
        const response = await client.events.get({
          calendarId: resolvedReference.calendarId,
          eventId: resolvedReference.eventId,
        });

        return mapGoogleEventToDomainEvent(response.data, resolvedReference.calendarId);
      } catch (error) {
        if (isNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    },

    async updateEvent(command: UpdateCalendarEventCommand) {
      const resolvedReference = resolveEventReference(command.reference, defaultCalendarId);
      const response = await client.events.patch({
        calendarId: resolvedReference.calendarId,
        eventId: resolvedReference.eventId,
        requestBody: mapEventPatchToGoogleEvent(command.changes),
      });

      return mapGoogleEventToDomainEvent(response.data, resolvedReference.calendarId);
    },

    async deleteEvent(command: DeleteCalendarEventCommand) {
      const resolvedReference = resolveEventReference(command.reference, defaultCalendarId);

      await client.events.delete({
        calendarId: resolvedReference.calendarId,
        eventId: resolvedReference.eventId,
      });
    },

    async listUpcomingEvents(command: ListUpcomingEventsCommand) {
      const anchorTime = normalizeAnchorTime(command.anchorTime);
      const timeMax = addDays(anchorTime, command.windowDays);
      const response = await client.events.list({
        calendarId: command.calendarId,
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: false,
        maxResults: command.limit,
        timeMin: anchorTime,
        timeMax,
      });

      return (response.data.items ?? [])
        .map((event) => mapGoogleEventToDomainEvent(event, command.calendarId))
        .filter((event) => event.status !== "cancelled");
    },

    async findNextMeeting(command: FindNextMeetingCommand) {
      const anchorTime = normalizeAnchorTime(command.anchorTime);
      const response = await client.events.list({
        calendarId: command.calendarId,
        singleEvents: true,
        orderBy: "startTime",
        showDeleted: false,
        maxResults: 10,
        timeMin: anchorTime,
      });

      const nextEvent = (response.data.items ?? [])
        .map((event) => mapGoogleEventToDomainEvent(event, command.calendarId))
        .find((event) => event.status !== "cancelled");

      return nextEvent ?? null;
    },
  };
}

function resolveEventReference(
  reference: GetCalendarEventCommand["reference"],
  defaultCalendarId: string,
): {
  calendarId: string;
  eventId: string;
} {
  if (!reference.eventId) {
    throw new NotImplementedYetError(
      "Google event resolution without an explicit eventId is not implemented yet.",
    );
  }

  return {
    calendarId: reference.calendarId ?? defaultCalendarId,
    eventId: reference.eventId,
  };
}

function normalizeAnchorTime(anchorTime: string | undefined): string {
  if (!anchorTime) {
    return new Date().toISOString();
  }

  return new Date(anchorTime).toISOString();
}

function addDays(anchorTime: string, dayCount: number): string {
  const date = new Date(anchorTime);
  date.setUTCDate(date.getUTCDate() + dayCount);
  return date.toISOString();
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: number;
    status?: number;
    response?: {
      status?: number;
    };
  };

  return (
    candidate.code === 404 ||
    candidate.status === 404 ||
    candidate.response?.status === 404
  );
}
