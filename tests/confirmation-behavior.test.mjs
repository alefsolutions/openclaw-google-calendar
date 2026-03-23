import assert from "node:assert/strict";
import test from "node:test";

import { prepareCreateCalendarEvent } from "../.test-dist/src/application/use-cases/create-calendar-event.js";
import { prepareDeleteCalendarEvent } from "../.test-dist/src/application/use-cases/delete-calendar-event.js";
import { prepareUpdateCalendarEvent } from "../.test-dist/src/application/use-cases/update-calendar-event.js";
import { resolveGoogleCalendarPluginConfig } from "../.test-dist/src/config/runtime-config.js";
import { registerGoogleCalendarTools } from "../.test-dist/src/tools/index.js";

test("prepareCreateCalendarEvent requires confirmation when confirmationMode is always", () => {
  const result = prepareCreateCalendarEvent(
    {
      summary: "Design review",
      start: {
        dateTime: "2026-03-24T09:00:00Z",
      },
      end: {
        dateTime: "2026-03-24T10:00:00Z",
      },
    },
    buildConfig({
      confirmationMode: "always",
    }),
  );

  assert.equal(result.status, "needs-confirmation");
  assert.match(result.message, /confirmed\": true/i);
});

test("prepareUpdateCalendarEvent requires confirmation for hint-based updates in the default mode", () => {
  const result = prepareUpdateCalendarEvent(
    {
      reference: {
        summaryHint: "Lunch",
      },
      changes: {
        summary: "Client lunch",
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "needs-confirmation");
  assert.match(result.message, /event update/i);
});

test("prepareUpdateCalendarEvent skips confirmation for explicit event ids in the default mode", () => {
  const result = prepareUpdateCalendarEvent(
    {
      reference: {
        eventId: "evt_123",
      },
      changes: {
        summary: "Client lunch",
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "ready");
});

test("prepareDeleteCalendarEvent requires confirmation in the default mode", () => {
  const result = prepareDeleteCalendarEvent(
    {
      reference: {
        eventId: "evt_delete",
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "needs-confirmation");
  assert.match(result.message, /event deletion/i);
});

test("prepareDeleteCalendarEvent can skip confirmation when confirmationMode is never", () => {
  const result = prepareDeleteCalendarEvent(
    {
      reference: {
        eventId: "evt_delete",
      },
    },
    buildConfig({
      confirmationMode: "never",
    }),
  );

  assert.equal(result.status, "ready");
});

test("create-event tool returns a confirmation message when confirmationMode is always", async () => {
  const tool = getRegisteredTool("google_calendar_create_event", {
    plugins: {
      entries: {
        "openclaw-google-calendar": {
          config: {
            confirmationMode: "always",
          },
        },
      },
    },
  });

  const result = await runTool(tool, {
    summary: "Design review",
    start: {
      dateTime: "2026-03-24T09:00:00Z",
    },
    end: {
      dateTime: "2026-03-24T10:00:00Z",
    },
  });

  assert.match(result.content[0].text, /confirm this calendar event creation/i);
  assert.match(result.content[0].text, /confirmed\": true/i);
});

test("delete-event tool returns a confirmation message before a destructive action", async () => {
  const tool = getRegisteredTool("google_calendar_delete_event", undefined);

  const result = await runTool(tool, {
    reference: {
      eventId: "evt_delete",
    },
  });

  assert.match(result.content[0].text, /confirm this calendar event deletion/i);
  assert.match(result.content[0].text, /confirmed\": true/i);
});

function buildConfig(overrides = {}) {
  return resolveGoogleCalendarPluginConfig(overrides, {});
}

function getRegisteredTool(toolName, config) {
  const registeredTools = [];
  const api = {
    config,
    registerTool(tool, options) {
      registeredTools.push({ tool, options });
    },
  };

  registerGoogleCalendarTools(api);

  const registeredTool = registeredTools.find(({ tool }) => tool.name === toolName)?.tool;

  assert.ok(registeredTool, `Expected tool ${toolName} to be registered.`);

  return registeredTool;
}

async function runTool(tool, params) {
  assert.ok(tool.execute, `Expected tool ${tool.name} to expose an execute function.`);

  return await tool.execute("tool-call-confirmation", params);
}
