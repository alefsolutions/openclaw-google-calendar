export const plannedGoogleCalendarTools = [
  {
    name: "google_calendar_create_event",
    description: "Create a Google Calendar event after missing details are clarified.",
  },
  {
    name: "google_calendar_get_event",
    description: "Read a single calendar event by reference or resolved identifier.",
  },
  {
    name: "google_calendar_update_event",
    description: "Update an existing event after ambiguity is resolved.",
  },
  {
    name: "google_calendar_delete_event",
    description: "Delete an existing calendar event.",
  },
  {
    name: "google_calendar_list_upcoming_events",
    description: "List upcoming Google Calendar events over a bounded time window.",
  },
  {
    name: "google_calendar_find_next_meeting",
    description: "Answer prompts such as 'what is my next meeting?'",
  },
] as const;
