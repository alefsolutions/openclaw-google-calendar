export interface CalendarDateTimeValue {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
}

export interface CalendarEventReference {
  eventId?: string;
  summaryHint?: string;
  startHint?: string;
  calendarId?: string;
}

export interface CalendarEventPatch {
  summary?: string;
  description?: string;
  location?: string;
  start?: CalendarDateTimeValue;
  end?: CalendarDateTimeValue;
  attendees?: CalendarAttendee[];
}

export interface CalendarEvent extends CalendarEventPatch {
  id: string;
  calendarId: string;
  summary: string;
  start: CalendarDateTimeValue;
  end: CalendarDateTimeValue;
  status?: "confirmed" | "tentative" | "cancelled";
  htmlLink?: string;
}
