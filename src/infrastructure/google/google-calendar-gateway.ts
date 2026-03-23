import type {
  CalendarGateway,
  CreateCalendarEventCommand,
  GetCalendarEventCommand,
  ListUpcomingEventsCommand,
  FindNextMeetingCommand,
  UpdateCalendarEventCommand,
  DeleteCalendarEventCommand,
} from "../../application/ports/calendar-gateway.js";
import { ResourceNotFoundError } from "../../shared/errors.js";
import { normalizeGoogleCalendarError } from "../../shared/google-calendar-error.js";
import type {
  GoogleCalendarClient,
  GoogleCalendarGatewayOptions,
} from "./google-calendar-client.js";
import {
  mapCreateCommandToGoogleEvent,
  mapEventPatchToGoogleEvent,
  mapGoogleEventToDomainEvent,
} from "./google-calendar-event-mapper.js";
import { resolveGoogleEventReference } from "./google-calendar-reference-resolution.js";

// This adapter owns raw Google Calendar API calls. Keeping it here lets the
// use-case layer stay focused on validation and clarification rules.
export function createGoogleCalendarGateway(
  client: GoogleCalendarClient,
  options: GoogleCalendarGatewayOptions = {},
): CalendarGateway {
  const defaultCalendarId = options.defaultCalendarId ?? "primary";

  return {
    async createEvent(command: CreateCalendarEventCommand) {
      try {
        const response = await client.events.insert({
          calendarId: command.calendarId,
          requestBody: mapCreateCommandToGoogleEvent(command),
        });

        return mapGoogleEventToDomainEvent(response.data, command.calendarId);
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "create a calendar event",
          phase: "calendar-api",
        });
      }
    },

    async getEvent(command: GetCalendarEventCommand) {
      const resolvedReference = await resolveGoogleEventReference(
        client,
        command.reference,
        defaultCalendarId,
      );

      if (!resolvedReference) {
        return null;
      }

      if (resolvedReference.matchedEvent) {
        return resolvedReference.matchedEvent;
      }

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

        throw normalizeGoogleCalendarError(error, {
          actionLabel: "read a calendar event",
          phase: "calendar-api",
        });
      }
    },

    async updateEvent(command: UpdateCalendarEventCommand) {
      const resolvedReference = await resolveGoogleEventReference(
        client,
        command.reference,
        defaultCalendarId,
      );

      if (!resolvedReference) {
        throw new ResourceNotFoundError("I could not find a matching calendar event to update.");
      }

      try {
        const response = await client.events.patch({
          calendarId: resolvedReference.calendarId,
          eventId: resolvedReference.eventId,
          requestBody: mapEventPatchToGoogleEvent(command.changes),
        });

        return mapGoogleEventToDomainEvent(response.data, resolvedReference.calendarId);
      } catch (error) {
        if (isNotFoundError(error)) {
          throw new ResourceNotFoundError(
            "I could not find a matching calendar event to update.",
          );
        }

        throw normalizeGoogleCalendarError(error, {
          actionLabel: "update a calendar event",
          phase: "calendar-api",
        });
      }
    },

    async deleteEvent(command: DeleteCalendarEventCommand) {
      const resolvedReference = await resolveGoogleEventReference(
        client,
        command.reference,
        defaultCalendarId,
      );

      if (!resolvedReference) {
        throw new ResourceNotFoundError("I could not find a matching calendar event to delete.");
      }

      try {
        await client.events.delete({
          calendarId: resolvedReference.calendarId,
          eventId: resolvedReference.eventId,
        });
      } catch (error) {
        if (isNotFoundError(error)) {
          throw new ResourceNotFoundError(
            "I could not find a matching calendar event to delete.",
          );
        }

        throw normalizeGoogleCalendarError(error, {
          actionLabel: "delete a calendar event",
          phase: "calendar-api",
        });
      }
    },

    async listUpcomingEvents(command: ListUpcomingEventsCommand) {
      try {
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
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "list upcoming calendar events",
          phase: "calendar-api",
        });
      }
    },

    async findNextMeeting(command: FindNextMeetingCommand) {
      try {
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
      } catch (error) {
        throw normalizeGoogleCalendarError(error, {
          actionLabel: "find the next meeting",
          phase: "calendar-api",
        });
      }
    },
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
