import type {
  CalendarGateway,
  CreateCalendarEventCommand,
  DeleteCalendarEventCommand,
  FindNextMeetingCommand,
  GetCalendarEventCommand,
  ListUpcomingEventsCommand,
  UpdateCalendarEventCommand,
} from "../../application/ports/calendar-gateway.js";
import { NotImplementedYetError } from "../../shared/errors.js";

// This adapter will own Google Calendar API calls later. Keeping it separate
// stops auth and HTTP code from leaking into the use-case layer.
export function createGoogleCalendarGateway(): CalendarGateway {
  return {
    async createEvent(_command: CreateCalendarEventCommand) {
      throw new NotImplementedYetError(
        "Google Calendar createEvent has not been implemented yet.",
      );
    },
    async getEvent(_command: GetCalendarEventCommand) {
      throw new NotImplementedYetError("Google Calendar getEvent has not been implemented yet.");
    },
    async updateEvent(_command: UpdateCalendarEventCommand) {
      throw new NotImplementedYetError(
        "Google Calendar updateEvent has not been implemented yet.",
      );
    },
    async deleteEvent(_command: DeleteCalendarEventCommand) {
      throw new NotImplementedYetError(
        "Google Calendar deleteEvent has not been implemented yet.",
      );
    },
    async listUpcomingEvents(_command: ListUpcomingEventsCommand) {
      throw new NotImplementedYetError(
        "Google Calendar listUpcomingEvents has not been implemented yet.",
      );
    },
    async findNextMeeting(_command: FindNextMeetingCommand) {
      throw new NotImplementedYetError(
        "Google Calendar findNextMeeting has not been implemented yet.",
      );
    },
  };
}
