export const googleCalendarReadOnlyScopes = [
  "https://www.googleapis.com/auth/calendar.events.readonly",
] as const;

export const googleCalendarReadWriteScopes = [
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export function getGoogleCalendarScopes(readOnlyMode: boolean): readonly string[] {
  return readOnlyMode ? googleCalendarReadOnlyScopes : googleCalendarReadWriteScopes;
}
