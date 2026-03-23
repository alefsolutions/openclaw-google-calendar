import assert from "node:assert/strict";
import test from "node:test";

import { createGoogleCalendarGateway } from "../.test-dist/src/infrastructure/google/google-calendar-gateway.js";

test("createEvent maps the command into a Google insert request", async () => {
  const calls = [];
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert(params) {
        calls.push({ method: "insert", params });

        return {
          data: {
            id: "evt_1",
            summary: params.requestBody.summary,
            description: params.requestBody.description,
            location: params.requestBody.location,
            start: params.requestBody.start,
            end: params.requestBody.end,
            attendees: params.requestBody.attendees,
            htmlLink: "https://calendar.google.com/event?eid=evt_1",
            status: "confirmed",
          },
        };
      },
      async get() {
        throw new Error("not used");
      },
      async patch() {
        throw new Error("not used");
      },
      async delete() {
        throw new Error("not used");
      },
      async list() {
        throw new Error("not used");
      },
    },
  });

  const event = await gateway.createEvent({
    calendarId: "primary",
    summary: "Design review",
    description: "Review the first draft",
    location: "Conference Room A",
    start: {
      dateTime: "2026-03-24T09:00:00.000Z",
      timeZone: "UTC",
    },
    end: {
      dateTime: "2026-03-24T10:00:00.000Z",
      timeZone: "UTC",
    },
    attendees: [
      {
        email: "alex@example.com",
        displayName: "Alex",
        responseStatus: "accepted",
      },
    ],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.calendarId, "primary");
  assert.equal(calls[0].params.requestBody.summary, "Design review");
  assert.equal(event.id, "evt_1");
  assert.equal(event.summary, "Design review");
  assert.equal(event.location, "Conference Room A");
  assert.equal(event.attendees[0].email, "alex@example.com");
});

test("getEvent returns null when Google responds with 404", async () => {
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert() {
        throw new Error("not used");
      },
      async get() {
        const error = new Error("not found");
        error.response = { status: 404 };
        throw error;
      },
      async patch() {
        throw new Error("not used");
      },
      async delete() {
        throw new Error("not used");
      },
      async list() {
        throw new Error("not used");
      },
    },
  });

  const event = await gateway.getEvent({
    reference: {
      eventId: "evt_missing",
      calendarId: "primary",
    },
  });

  assert.equal(event, null);
});

test("updateEvent uses patch with the configured default calendar id", async () => {
  const calls = [];
  const gateway = createGoogleCalendarGateway(
    {
      events: {
        async insert() {
          throw new Error("not used");
        },
        async get() {
          throw new Error("not used");
        },
        async patch(params) {
          calls.push({ method: "patch", params });

          return {
            data: {
              id: params.eventId,
              summary: params.requestBody.summary,
              start: {
                dateTime: "2026-03-24T09:00:00.000Z",
              },
              end: {
                dateTime: "2026-03-24T10:00:00.000Z",
              },
              status: "confirmed",
            },
          };
        },
        async delete() {
          throw new Error("not used");
        },
        async list() {
          throw new Error("not used");
        },
      },
    },
    {
      defaultCalendarId: "team-calendar",
    },
  );

  const event = await gateway.updateEvent({
    reference: {
      eventId: "evt_2",
    },
    changes: {
      summary: "Updated title",
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.calendarId, "team-calendar");
  assert.equal(calls[0].params.eventId, "evt_2");
  assert.equal(event.summary, "Updated title");
});

test("deleteEvent sends the delete request to Google", async () => {
  const calls = [];
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert() {
        throw new Error("not used");
      },
      async get() {
        throw new Error("not used");
      },
      async patch() {
        throw new Error("not used");
      },
      async delete(params) {
        calls.push({ method: "delete", params });
        return { data: {} };
      },
      async list() {
        throw new Error("not used");
      },
    },
  });

  await gateway.deleteEvent({
    reference: {
      eventId: "evt_3",
      calendarId: "primary",
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.eventId, "evt_3");
});

test("listUpcomingEvents maps list results and filters cancelled events", async () => {
  const calls = [];
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert() {
        throw new Error("not used");
      },
      async get() {
        throw new Error("not used");
      },
      async patch() {
        throw new Error("not used");
      },
      async delete() {
        throw new Error("not used");
      },
      async list(params) {
        calls.push({ method: "list", params });

        return {
          data: {
            items: [
              {
                id: "evt_4",
                summary: "Standup",
                start: {
                  dateTime: "2026-03-24T09:00:00.000Z",
                },
                end: {
                  dateTime: "2026-03-24T09:15:00.000Z",
                },
                status: "confirmed",
              },
              {
                id: "evt_5",
                summary: "Cancelled meeting",
                start: {
                  dateTime: "2026-03-24T10:00:00.000Z",
                },
                end: {
                  dateTime: "2026-03-24T10:30:00.000Z",
                },
                status: "cancelled",
              },
            ],
          },
        };
      },
    },
  });

  const events = await gateway.listUpcomingEvents({
    calendarId: "primary",
    windowDays: 7,
    limit: 10,
    anchorTime: "2026-03-24T00:00:00.000Z",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].params.calendarId, "primary");
  assert.equal(calls[0].params.maxResults, 10);
  assert.equal(events.length, 1);
  assert.equal(events[0].summary, "Standup");
});

test("findNextMeeting returns the first non-cancelled event", async () => {
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert() {
        throw new Error("not used");
      },
      async get() {
        throw new Error("not used");
      },
      async patch() {
        throw new Error("not used");
      },
      async delete() {
        throw new Error("not used");
      },
      async list() {
        return {
          data: {
            items: [
              {
                id: "evt_6",
                summary: "Cancelled check-in",
                start: {
                  dateTime: "2026-03-24T09:00:00.000Z",
                },
                end: {
                  dateTime: "2026-03-24T09:30:00.000Z",
                },
                status: "cancelled",
              },
              {
                id: "evt_7",
                summary: "Planning meeting",
                start: {
                  dateTime: "2026-03-24T10:00:00.000Z",
                },
                end: {
                  dateTime: "2026-03-24T11:00:00.000Z",
                },
                status: "confirmed",
              },
            ],
          },
        };
      },
    },
  });

  const event = await gateway.findNextMeeting({
    calendarId: "primary",
    anchorTime: "2026-03-24T00:00:00.000Z",
  });

  assert.ok(event);
  assert.equal(event.id, "evt_7");
  assert.equal(event.summary, "Planning meeting");
});

test("getEvent without an event id is deferred to the later reference-resolution task", async () => {
  const gateway = createGoogleCalendarGateway({
    events: {
      async insert() {
        throw new Error("not used");
      },
      async get() {
        throw new Error("not used");
      },
      async patch() {
        throw new Error("not used");
      },
      async delete() {
        throw new Error("not used");
      },
      async list() {
        throw new Error("not used");
      },
    },
  });

  await assert.rejects(
    () =>
      gateway.getEvent({
        reference: {
          summaryHint: "Team sync",
        },
      }),
    /without an explicit eventId/i,
  );
});
