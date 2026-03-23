import assert from "node:assert/strict";
import test from "node:test";

import {
  AmbiguousCalendarEventReferenceError,
  AuthenticationRequiredError,
  ResourceNotFoundError,
} from "../.test-dist/src/shared/errors.js";
import { registerGoogleCalendarTools } from "../.test-dist/src/tools/index.js";

test("begin-auth tool returns the authorization URL from the auth service", async () => {
  const tool = getRegisteredTool("google_calendar_begin_auth", undefined, {
    authServiceFactory() {
      return {
        async createAuthorizationUrl() {
          return {
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=tool",
            redirectUri: "http://127.0.0.1:3000/oauth2callback",
            scopes: ["https://www.googleapis.com/auth/calendar.events"],
          };
        },
        async exchangeCodeForToken() {
          throw new Error("not used");
        },
        async hasStoredToken() {
          return false;
        },
        async createAuthenticatedCalendarClient() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /authorize Google Calendar access/i);
  assert.match(result.content[0].text, /oauth2\/v2\/auth\?mock=tool/i);
});

test("complete-auth tool stores the authorization code through the auth service", async () => {
  let receivedCode;
  const tool = getRegisteredTool("google_calendar_complete_auth", undefined, {
    authServiceFactory() {
      return {
        async createAuthorizationUrl() {
          throw new Error("not used");
        },
        async exchangeCodeForToken(code) {
          receivedCode = code;
          return {
            tokenPath: "./secrets/google-calendar-token.json",
            hasRefreshToken: true,
            scope: "https://www.googleapis.com/auth/calendar.events",
            expiryDate: Date.parse("2026-03-24T00:00:00.000Z"),
          };
        },
        async hasStoredToken() {
          return false;
        },
        async createAuthenticatedCalendarClient() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    authorizationCode: "auth-code-123",
  });

  assert.equal(receivedCode, "auth-code-123");
  assert.match(result.content[0].text, /authentication is complete/i);
  assert.match(result.content[0].text, /google-calendar-token\.json/i);
});

test("create-event tool uses the gateway after validation succeeds", async () => {
  let createCommand;
  const tool = getRegisteredTool("google_calendar_create_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent(command) {
          createCommand = command;
          return {
            id: "evt_created",
            calendarId: command.calendarId,
            summary: command.summary,
            start: command.start,
            end: command.end,
            location: command.location,
            description: command.description,
          };
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    summary: "Design review",
    start: {
      dateTime: "2026-03-24T09:00:00.000Z",
      timeZone: "UTC",
    },
    end: {
      dateTime: "2026-03-24T10:00:00.000Z",
      timeZone: "UTC",
    },
  });

  assert.equal(createCommand.summary, "Design review");
  assert.match(result.content[0].text, /Created calendar event/i);
  assert.match(result.content[0].text, /evt_created/i);
});

test("get-event tool formats the returned event details", async () => {
  const tool = getRegisteredTool("google_calendar_get_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          return {
            id: "evt_get",
            calendarId: "primary",
            summary: "Planning meeting",
            start: {
              dateTime: "2026-03-24T11:00:00.000Z",
            },
            end: {
              dateTime: "2026-03-24T12:00:00.000Z",
            },
          };
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      eventId: "evt_get",
    },
  });

  assert.match(result.content[0].text, /Calendar event:/i);
  assert.match(result.content[0].text, /Planning meeting/i);
});

test("update-event tool uses the gateway and returns the updated event", async () => {
  const tool = getRegisteredTool("google_calendar_update_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent(command) {
          return {
            id: command.reference.eventId,
            calendarId: "primary",
            summary: command.changes.summary,
            start: {
              dateTime: "2026-03-24T09:00:00.000Z",
            },
            end: {
              dateTime: "2026-03-24T10:00:00.000Z",
            },
          };
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      eventId: "evt_update",
    },
    changes: {
      summary: "Updated planning meeting",
    },
  });

  assert.match(result.content[0].text, /Updated calendar event/i);
  assert.match(result.content[0].text, /Updated planning meeting/i);
});

test("delete-event tool returns a success message after the gateway deletes the event", async () => {
  let deletedEventId;
  const tool = getRegisteredTool("google_calendar_delete_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent(command) {
          deletedEventId = command.reference.eventId;
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      eventId: "evt_delete",
    },
  });

  assert.equal(deletedEventId, "evt_delete");
  assert.match(result.content[0].text, /Deleted calendar event evt_delete/i);
});

test("delete-event tool gives a readable success message for hint-based deletion", async () => {
  const tool = getRegisteredTool("google_calendar_delete_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          return undefined;
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      summaryHint: "Lunch",
    },
  });

  assert.match(result.content[0].text, /matching "Lunch"/i);
});

test("list-upcoming-events tool formats the gateway response", async () => {
  const tool = getRegisteredTool("google_calendar_list_upcoming_events", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          return [
            {
              id: "evt_list",
              calendarId: "primary",
              summary: "Standup",
              start: {
                dateTime: "2026-03-24T09:00:00.000Z",
              },
              end: {
                dateTime: "2026-03-24T09:15:00.000Z",
              },
            },
          ];
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /Upcoming events in calendar primary/i);
  assert.match(result.content[0].text, /Standup/i);
});

test("find-next-meeting tool formats the next meeting details", async () => {
  const tool = getRegisteredTool("google_calendar_find_next_meeting", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          return {
            id: "evt_next",
            calendarId: "primary",
            summary: "Design sync",
            start: {
              dateTime: "2026-03-24T13:00:00.000Z",
            },
            end: {
              dateTime: "2026-03-24T14:00:00.000Z",
            },
          };
        },
      };
    },
  });

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /Your next meeting is/i);
  assert.match(result.content[0].text, /Design sync/i);
});

test("tools return auth guidance when authentication is required", async () => {
  const tool = getRegisteredTool("google_calendar_list_upcoming_events", undefined, {
    authServiceFactory() {
      return {
        async createAuthorizationUrl() {
          return {
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=needs-auth",
            redirectUri: "http://127.0.0.1:3000/oauth2callback",
            scopes: ["https://www.googleapis.com/auth/calendar.events.readonly"],
          };
        },
        async exchangeCodeForToken() {
          throw new Error("not used");
        },
        async hasStoredToken() {
          return false;
        },
        async createAuthenticatedCalendarClient() {
          throw new AuthenticationRequiredError("not authenticated yet");
        },
      };
    },
  });

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /authorization is required/i);
  assert.match(result.content[0].text, /google_calendar_complete_auth/i);
  assert.match(result.content[0].text, /mock=needs-auth/i);
});

test("tools return a clarification-style message when event lookup is ambiguous", async () => {
  const tool = getRegisteredTool("google_calendar_update_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new AmbiguousCalendarEventReferenceError(
            "ambiguous",
            [
              {
                id: "evt_1",
                calendarId: "primary",
                summary: "Lunch",
                start: "2026-03-24T12:00:00.000Z",
              },
              {
                id: "evt_2",
                calendarId: "primary",
                summary: "Lunch",
                start: "2026-03-24T15:00:00.000Z",
              },
            ],
          );
        },
        async deleteEvent() {
          throw new Error("not used");
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      summaryHint: "Lunch",
    },
    changes: {
      summary: "Client lunch",
    },
  });

  assert.match(result.content[0].text, /more than one possible event/i);
  assert.match(result.content[0].text, /eventId or a more specific startHint/i);
  assert.match(result.content[0].text, /evt_1/i);
  assert.match(result.content[0].text, /evt_2/i);
});

test("tools return the not-found message from the gateway", async () => {
  const tool = getRegisteredTool("google_calendar_delete_event", undefined, {
    authServiceFactory() {
      return createPassThroughAuthService();
    },
    gatewayFactory() {
      return {
        async createEvent() {
          throw new Error("not used");
        },
        async getEvent() {
          throw new Error("not used");
        },
        async updateEvent() {
          throw new Error("not used");
        },
        async deleteEvent() {
          throw new ResourceNotFoundError(
            "I could not find a matching calendar event to delete.",
          );
        },
        async listUpcomingEvents() {
          throw new Error("not used");
        },
        async findNextMeeting() {
          throw new Error("not used");
        },
      };
    },
  });

  const result = await runTool(tool, {
    reference: {
      summaryHint: "Missing lunch",
    },
  });

  assert.equal(result.content[0].text, "I could not find a matching calendar event to delete.");
});

function getRegisteredTool(toolName, config, dependencies) {
  const registeredTools = [];
  const api = {
    config,
    registerTool(tool, options) {
      registeredTools.push({ tool, options });
    },
  };

  registerGoogleCalendarTools(api, dependencies);

  const registeredTool = registeredTools.find(({ tool }) => tool.name === toolName)?.tool;

  assert.ok(registeredTool, `Expected tool ${toolName} to be registered.`);

  return registeredTool;
}

async function runTool(tool, params) {
  assert.ok(tool.execute, `Expected tool ${tool.name} to expose an execute function.`);

  return await tool.execute("tool-call-1", params);
}

function createPassThroughAuthService() {
  return {
    async createAuthorizationUrl() {
      return {
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=unused",
        redirectUri: "http://127.0.0.1:3000/oauth2callback",
        scopes: ["https://www.googleapis.com/auth/calendar.events"],
      };
    },
    async exchangeCodeForToken() {
      throw new Error("not used");
    },
    async hasStoredToken() {
      return true;
    },
    async createAuthenticatedCalendarClient() {
      return {
        events: {},
      };
    },
  };
}
