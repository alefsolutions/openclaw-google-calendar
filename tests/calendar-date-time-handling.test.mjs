import assert from "node:assert/strict";
import test from "node:test";

import { prepareCreateCalendarEvent } from "../.test-dist/src/application/use-cases/create-calendar-event.js";
import { prepareUpdateCalendarEvent } from "../.test-dist/src/application/use-cases/update-calendar-event.js";
import { resolveGoogleCalendarPluginConfig } from "../.test-dist/src/config/runtime-config.js";
import { PluginConfigurationError } from "../.test-dist/src/shared/errors.js";

test("resolveGoogleCalendarPluginConfig accepts a valid default time zone", () => {
  const config = resolveGoogleCalendarPluginConfig(
    {
      defaultTimeZone: "America/Los_Angeles",
    },
    {},
  );

  assert.equal(config.defaultTimeZone, "America/Los_Angeles");
});

test("resolveGoogleCalendarPluginConfig rejects an invalid default time zone", () => {
  assert.throws(
    () =>
      resolveGoogleCalendarPluginConfig(
        {
          defaultTimeZone: "Mars/Olympus_Mons",
        },
        {},
      ),
    PluginConfigurationError,
  );
});

test("prepareCreateCalendarEvent defaults a timed event end and injects the configured time zone", () => {
  const config = buildConfig({
    defaultTimeZone: "America/Los_Angeles",
  });

  const result = prepareCreateCalendarEvent(
    {
      summary: "Focus block",
      start: {
        dateTime: "2026-03-24T09:00",
      },
    },
    config,
  );

  assert.equal(result.status, "ready");
  assert.deepEqual(result.value.start, {
    dateTime: "2026-03-24T09:00:00.000",
    timeZone: "America/Los_Angeles",
  });
  assert.deepEqual(result.value.end, {
    dateTime: "2026-03-24T10:00:00.000",
    timeZone: "America/Los_Angeles",
  });
});

test("prepareCreateCalendarEvent defaults an all-day event end to the next day", () => {
  const config = buildConfig({
    defaultTimeZone: "America/Los_Angeles",
  });

  const result = prepareCreateCalendarEvent(
    {
      summary: "Day off",
      start: {
        date: "2026-03-24",
      },
    },
    config,
  );

  assert.equal(result.status, "ready");
  assert.deepEqual(result.value.start, {
    date: "2026-03-24",
    timeZone: "America/Los_Angeles",
  });
  assert.deepEqual(result.value.end, {
    date: "2026-03-25",
    timeZone: "America/Los_Angeles",
  });
});

test("prepareCreateCalendarEvent blocks mixed all-day and timed values", () => {
  const result = prepareCreateCalendarEvent(
    {
      summary: "Broken event",
      start: {
        date: "2026-03-24",
      },
      end: {
        dateTime: "2026-03-24T09:00:00Z",
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /both be all-day values or both be timed values/i);
});

test("prepareCreateCalendarEvent blocks local timed values when no time zone is available", () => {
  const result = prepareCreateCalendarEvent(
    {
      summary: "Time zone missing",
      start: {
        dateTime: "2026-03-24T09:00",
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /needs a timeZone/i);
});

test("prepareUpdateCalendarEvent normalizes local timed updates with the configured time zone", () => {
  const result = prepareUpdateCalendarEvent(
    {
      reference: {
        summaryHint: "Lunch",
      },
      confirmed: true,
      changes: {
        start: {
          dateTime: "2026-03-24T12:00",
        },
        end: {
          dateTime: "2026-03-24T13:30",
        },
      },
    },
    buildConfig({
      defaultTimeZone: "America/New_York",
    }),
  );

  assert.equal(result.status, "ready");
  assert.deepEqual(result.value.changes.start, {
    dateTime: "2026-03-24T12:00:00.000",
    timeZone: "America/New_York",
  });
  assert.deepEqual(result.value.changes.end, {
    dateTime: "2026-03-24T13:30:00.000",
    timeZone: "America/New_York",
  });
});

test("prepareUpdateCalendarEvent blocks incompatible updated start and end formats", () => {
  const result = prepareUpdateCalendarEvent(
    {
      reference: {
        summaryHint: "Lunch",
      },
      changes: {
        start: {
          date: "2026-03-24",
        },
        end: {
          dateTime: "2026-03-24T13:00:00Z",
        },
      },
    },
    buildConfig(),
  );

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /both be all-day values or both be timed values/i);
});

function buildConfig(overrides = {}) {
  return resolveGoogleCalendarPluginConfig(overrides, {});
}
