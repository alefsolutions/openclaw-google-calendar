import assert from "node:assert/strict";
import test from "node:test";

import { registerGoogleCalendarTools } from "../.test-dist/src/tools/index.js";

test("registerGoogleCalendarTools registers all expected tools as optional", () => {
  const registeredTools = [];
  const api = {
    registerTool(tool, options) {
      registeredTools.push({ tool, options });
    },
  };

  registerGoogleCalendarTools(api);

  assert.equal(registeredTools.length, 8);
  assert.deepEqual(
    registeredTools.map(({ tool }) => tool.name),
    [
      "google_calendar_begin_auth",
      "google_calendar_complete_auth",
      "google_calendar_create_event",
      "google_calendar_get_event",
      "google_calendar_update_event",
      "google_calendar_delete_event",
      "google_calendar_list_upcoming_events",
      "google_calendar_find_next_meeting",
    ],
  );

  for (const { tool, options } of registeredTools) {
    assert.equal(options?.optional, true);
    assert.equal(typeof tool.description, "string");
    assert.equal(typeof tool.execute, "function");
    assert.equal(typeof tool.parameters, "object");
  }
});

test("create-event tool asks for clarification when required fields are missing", async () => {
  const tool = getRegisteredTool("google_calendar_create_event");

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /I need a bit more detail/i);
  assert.match(result.content[0].text, /What should the event title be\?/i);
  assert.match(result.content[0].text, /When should the event start\?/i);
  assert.match(result.content[0].text, /When should the event end\?/i);
});

test("delete-event tool respects read-only mode from plugin config", async () => {
  const tool = getRegisteredTool("google_calendar_delete_event", {
    plugins: {
      entries: {
        "openclaw-google-calendar": {
          config: {
            readOnlyMode: true,
          },
        },
      },
    },
  });

  const result = await runTool(tool, {
    reference: {
      eventId: "evt_123",
    },
  });

  assert.match(result.content[0].text, /read-only mode/i);
});

test("complete-auth tool asks for an authorization code when it is missing", async () => {
  const tool = getRegisteredTool("google_calendar_complete_auth");

  const result = await runTool(tool, {});

  assert.match(result.content[0].text, /need the Google authorization code/i);
});

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

  return await tool.execute("tool-call-1", params);
}
