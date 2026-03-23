import type { CalendarEvent, CalendarEventReference } from "../../domain/calendar-event.js";
import { AmbiguousCalendarEventReferenceError } from "../../shared/errors.js";
import type { GoogleCalendarClient } from "./google-calendar-client.js";
import { mapGoogleEventToDomainEvent } from "./google-calendar-event-mapper.js";

export interface ResolvedGoogleEventReference {
  calendarId: string;
  eventId: string;
  matchedEvent?: CalendarEvent;
}

// This helper keeps lookup heuristics in one place so the gateway can stay
// focused on CRUD calls instead of ranking possible matches.
export async function resolveGoogleEventReference(
  client: GoogleCalendarClient,
  reference: CalendarEventReference,
  defaultCalendarId: string,
): Promise<ResolvedGoogleEventReference | null> {
  const calendarId = reference.calendarId ?? defaultCalendarId;

  if (reference.eventId) {
    return {
      calendarId,
      eventId: reference.eventId,
    };
  }

  const candidateEvents = await findCandidateEvents(client, reference, calendarId);

  if (candidateEvents.length === 0) {
    return null;
  }

  if (candidateEvents.length > 1) {
    throw new AmbiguousCalendarEventReferenceError(
      "I found more than one calendar event that matches this request.",
      candidateEvents.map((event) => ({
        id: event.id,
        calendarId: event.calendarId,
        summary: event.summary,
        start: event.start.dateTime ?? event.start.date,
      })),
    );
  }

  return {
    calendarId,
    eventId: candidateEvents[0].id,
    matchedEvent: candidateEvents[0],
  };
}

async function findCandidateEvents(
  client: GoogleCalendarClient,
  reference: CalendarEventReference,
  calendarId: string,
): Promise<CalendarEvent[]> {
  const response = await client.events.list({
    calendarId,
    singleEvents: true,
    orderBy: "startTime",
    showDeleted: false,
    maxResults: 10,
    q: reference.summaryHint,
    ...buildStartHintWindow(reference.startHint),
  });

  const rankedCandidates = (response.data.items ?? [])
    .map((event) => mapGoogleEventToDomainEvent(event, calendarId))
    .filter((event) => event.id.length > 0 && event.status !== "cancelled")
    .map((event) => ({
      event,
      score: calculateMatchScore(reference, event),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        event: CalendarEvent;
        score: number;
      } => candidate.score !== null,
    )
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return compareEventStarts(left.event, right.event);
    });

  if (rankedCandidates.length === 0) {
    return [];
  }

  const bestScore = rankedCandidates[0].score;

  return rankedCandidates
    .filter((candidate) => candidate.score === bestScore)
    .map((candidate) => candidate.event);
}

function calculateMatchScore(
  reference: CalendarEventReference,
  event: CalendarEvent,
): number | null {
  const summaryScore = calculateSummaryScore(reference.summaryHint, event.summary);
  const startScore = calculateStartScore(reference.startHint, event);

  if (reference.summaryHint && summaryScore === null) {
    return null;
  }

  if (reference.startHint && startScore === null) {
    return null;
  }

  return (summaryScore ?? 0) + (startScore ?? 0);
}

function calculateSummaryScore(summaryHint: string | undefined, summary: string): number | null {
  if (!summaryHint) {
    return 0;
  }

  const normalizedHint = normalizeSearchText(summaryHint);
  const normalizedSummary = normalizeSearchText(summary);

  if (!normalizedHint || !normalizedSummary) {
    return null;
  }

  if (normalizedSummary === normalizedHint) {
    return 100;
  }

  if (
    normalizedSummary.includes(normalizedHint) ||
    normalizedHint.includes(normalizedSummary)
  ) {
    return 70;
  }

  const hintTokens = normalizedHint.split(" ").filter((token) => token.length > 0);

  if (hintTokens.length > 0 && hintTokens.every((token) => normalizedSummary.includes(token))) {
    return 50;
  }

  return null;
}

function calculateStartScore(
  startHint: string | undefined,
  event: CalendarEvent,
): number | null {
  if (!startHint) {
    return 0;
  }

  const normalizedHint = startHint.trim();
  const eventStartValue = event.start.dateTime ?? event.start.date;

  if (!eventStartValue) {
    return null;
  }

  if (event.start.date && normalizedHint === event.start.date) {
    return 100;
  }

  const exactHintTime = Date.parse(normalizedHint);
  const exactEventTime = event.start.dateTime ? Date.parse(event.start.dateTime) : Number.NaN;

  if (
    !Number.isNaN(exactHintTime) &&
    !Number.isNaN(exactEventTime) &&
    exactHintTime === exactEventTime
  ) {
    return 100;
  }

  const hintDay = getDayKey(normalizedHint);
  const eventDay = getEventDayKey(event);

  if (hintDay && eventDay && hintDay === eventDay) {
    return 60;
  }

  return null;
}

function compareEventStarts(left: CalendarEvent, right: CalendarEvent): number {
  const leftValue = Date.parse(left.start.dateTime ?? left.start.date ?? "");
  const rightValue = Date.parse(right.start.dateTime ?? right.start.date ?? "");

  if (Number.isNaN(leftValue) && Number.isNaN(rightValue)) {
    return left.id.localeCompare(right.id);
  }

  if (Number.isNaN(leftValue)) {
    return 1;
  }

  if (Number.isNaN(rightValue)) {
    return -1;
  }

  return leftValue - rightValue;
}

function buildStartHintWindow(startHint: string | undefined): {
  timeMin?: string;
  timeMax?: string;
} {
  if (!startHint) {
    return {};
  }

  const hintDay = getDayKey(startHint);

  if (!hintDay) {
    return {};
  }

  const windowStart = new Date(`${hintDay}T00:00:00.000Z`);
  const windowEnd = new Date(windowStart);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

  return {
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
  };
}

function getEventDayKey(event: CalendarEvent): string | undefined {
  if (event.start.date) {
    return event.start.date;
  }

  return getDayKey(event.start.dateTime);
}

function getDayKey(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const parsedValue = new Date(trimmedValue);

  if (Number.isNaN(parsedValue.getTime())) {
    return undefined;
  }

  return parsedValue.toISOString().slice(0, 10);
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
