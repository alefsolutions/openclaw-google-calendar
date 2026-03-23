export const googleCalendarToolCatalog = {
  beginAuth: {
    name: "google_calendar_begin_auth",
    description: "Generate a Google OAuth URL so the plugin can be authorized to access Google Calendar.",
  },
  completeAuth: {
    name: "google_calendar_complete_auth",
    description: "Store Google OAuth tokens by exchanging an authorization code returned after consent.",
  },
  createEvent: {
    name: "google_calendar_create_event",
    description: "Create a Google Calendar event after missing details are clarified.",
  },
  getEvent: {
    name: "google_calendar_get_event",
    description: "Read a single calendar event by reference or resolved identifier.",
  },
  updateEvent: {
    name: "google_calendar_update_event",
    description: "Update an existing event after ambiguity is resolved.",
  },
  deleteEvent: {
    name: "google_calendar_delete_event",
    description: "Delete an existing calendar event.",
  },
  listUpcomingEvents: {
    name: "google_calendar_list_upcoming_events",
    description: "List upcoming Google Calendar events over a bounded time window.",
  },
  findNextMeeting: {
    name: "google_calendar_find_next_meeting",
    description: "Answer prompts such as 'what is my next meeting?'",
  },
} as const;
