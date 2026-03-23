import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const skillPath =
  "c:\\Git Projects\\openclaw-google-calendar\\skills\\google-calendar-assistant\\SKILL.md";

test("the Google Calendar skill documents the shipped tool names", async () => {
  const skill = await readFile(skillPath, "utf8");

  for (const toolName of [
    "google_calendar_begin_auth",
    "google_calendar_complete_auth",
    "google_calendar_create_event",
    "google_calendar_get_event",
    "google_calendar_update_event",
    "google_calendar_delete_event",
    "google_calendar_list_upcoming_events",
    "google_calendar_find_next_meeting",
  ]) {
    assert.ok(
      skill.includes(toolName),
      `Expected the skill to document ${toolName}.`,
    );
  }
});

test("the Google Calendar skill documents confirmation, auth, and ambiguity behavior", async () => {
  const skill = await readFile(skillPath, "utf8");

  assert.match(skill, /confirmed:\s*true/i);
  assert.match(skill, /authorization/i);
  assert.match(skill, /eventId/i);
  assert.match(skill, /summaryHint/i);
  assert.match(skill, /startHint/i);
  assert.match(skill, /read-only mode/i);
});
