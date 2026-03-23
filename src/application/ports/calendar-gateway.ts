import type {
  CalendarAttendee,
  CalendarDateTimeValue,
  CalendarEvent,
  CalendarEventPatch,
  CalendarEventReference,
} from "../../domain/calendar-event.js";

export interface CreateCalendarEventCommand {
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarDateTimeValue;
  end: CalendarDateTimeValue;
  attendees?: CalendarAttendee[];
}

export interface GetCalendarEventCommand {
  reference: CalendarEventReference;
}

export interface UpdateCalendarEventCommand {
  reference: CalendarEventReference;
  changes: CalendarEventPatch;
}

export interface DeleteCalendarEventCommand {
  reference: CalendarEventReference;
}

export interface ListUpcomingEventsCommand {
  calendarId: string;
  windowDays: number;
  limit: number;
  anchorTime?: string;
}

export interface FindNextMeetingCommand {
  calendarId: string;
  anchorTime?: string;
}

export interface CalendarGateway {
  createEvent(command: CreateCalendarEventCommand): Promise<CalendarEvent>;
  getEvent(command: GetCalendarEventCommand): Promise<CalendarEvent | null>;
  updateEvent(command: UpdateCalendarEventCommand): Promise<CalendarEvent>;
  deleteEvent(command: DeleteCalendarEventCommand): Promise<void>;
  listUpcomingEvents(command: ListUpcomingEventsCommand): Promise<CalendarEvent[]>;
  findNextMeeting(command: FindNextMeetingCommand): Promise<CalendarEvent | null>;
}
