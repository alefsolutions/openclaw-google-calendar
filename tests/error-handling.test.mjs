import assert from "node:assert/strict";
import test from "node:test";

import { createGoogleCalendarGateway } from "../.test-dist/src/infrastructure/google/google-calendar-gateway.js";
import {
  redactSensitiveText,
  normalizeGoogleCalendarError,
} from "../.test-dist/src/shared/google-calendar-error.js";
import {
  AuthenticationRequiredError,
  ExternalServiceError,
} from "../.test-dist/src/shared/errors.js";
import { registerGoogleCalendarTools } from "../.test-dist/src/tools/index.js";

test("redactSensitiveText removes OAuth tokens and codes from text", () => {
  const redacted = redactSensitiveText(
    "access_token=abc refresh_token=def code=ghi Authorization: Bearer top-secret-token",
  );

  assert.equal(
    redacted,
    "access_token=[redacted] refresh_token=[redacted] code=[redacted] Authorization: Bearer [redacted]",
  );
});

test("normalizeGoogleCalendarError maps invalid_grant to a reauthorization error", () => {
  const error = {
    response: {
      status: 400,
      data: {
        error: {
          message: "invalid_grant access_token=should-not-leak",
          errors: [{ reason: "invalid_grant" }],
        },
      },
    },
  };

  const normalizedError = normalizeGoogleCalendarError(error, {
    actionLabel: "complete Google Calendar authentication",
    phase: "token-exchange",
  });

  assert.ok(normalizedError instanceof AuthenticationRequiredError);
  assert.match(normalizedError.message, /fresh code/i);
  assert.doesNotMatch(normalizedError.message, /should-not-leak/i);
});

test("listUpcomingEvents converts Google rate limits into a safe external-service error", async () => {
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
        const error = new Error("quota exceeded");
        error.response = {
          status: 429,
          data: {
            error: {
              errors: [{ reason: "userRateLimitExceeded" }],
            },
          },
        };
        throw error;
      },
    },
  });

  await assert.rejects(
    () =>
      gateway.listUpcomingEvents({
        calendarId: "primary",
        windowDays: 7,
        limit: 10,
        anchorTime: "2026-03-24T00:00:00.000Z",
      }),
    (error) => {
      assert.ok(error instanceof ExternalServiceError);
      assert.match(error.message, /rate limiting/i);
      return true;
    },
  );
});

test("complete-auth tool returns a safe retry message when reauthorization is required", async () => {
  const tool = getRegisteredTool("google_calendar_complete_auth", undefined, {
    authServiceFactory() {
      return {
        async createAuthorizationUrl() {
          return {
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=retry-auth",
            redirectUri: "http://127.0.0.1:3000/oauth2callback",
            scopes: ["https://www.googleapis.com/auth/calendar.events"],
          };
        },
        async exchangeCodeForToken() {
          throw new AuthenticationRequiredError(
            "Google rejected the authorization code. Start the authorization flow again and use a fresh code.",
          );
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
    authorizationCode: "expired-code",
  });

  assert.match(result.content[0].text, /could not complete Google Calendar authentication/i);
  assert.match(result.content[0].text, /fresh code/i);
  assert.match(result.content[0].text, /retry-auth/i);
});

test("auth tools do not leak raw provider errors when an unexpected error occurs", async () => {
  const tool = getRegisteredTool("google_calendar_complete_auth", undefined, {
    authServiceFactory() {
      return {
        async createAuthorizationUrl() {
          return {
            authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?mock=unused",
            redirectUri: "http://127.0.0.1:3000/oauth2callback",
            scopes: ["https://www.googleapis.com/auth/calendar.events"],
          };
        },
        async exchangeCodeForToken() {
          throw new Error("invalid_grant access_token=top-secret-token");
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
    authorizationCode: "code-123",
  });

  assert.match(result.content[0].text, /unexpected error/i);
  assert.doesNotMatch(result.content[0].text, /top-secret-token/i);
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

  return await tool.execute("tool-call-error", params);
}
