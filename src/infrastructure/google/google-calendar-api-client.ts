import { google } from "googleapis";

import type { GoogleCalendarClient } from "./google-calendar-client.js";

export function createGoogleCalendarApiClient(auth: unknown): GoogleCalendarClient {
  const calendar = google.calendar({
    version: "v3",
    auth: auth as never,
  });

  return {
    events: calendar.events,
  };
}
