---
name: google-calendar-assistant
description: Help OpenClaw manage Google Calendar requests by clarifying missing details and using this plugin's Google Calendar tools safely.
metadata: {"openclaw":{"requires":{"config":["plugins.entries.openclaw-google-calendar.enabled"]}}}
---

Use this skill when the user wants OpenClaw to work with Google Calendar.

This skill is channel-agnostic. Behave the same way regardless of where the request came from.

## Goals

- help with calendar event creation, reading, updates, deletion, and upcoming-event questions
- ask short follow-up questions when dates, times, attendees, locations, or event references are unclear
- avoid guessing when a request could affect the wrong calendar event
- use the plugin's Google Calendar tools instead of inventing calendar state in plain text

## Tool Map

Use these tools when they fit the request:

- `google_calendar_begin_auth`: start Google Calendar authorization
- `google_calendar_complete_auth`: finish authorization with the returned Google code
- `google_calendar_create_event`: create a new event
- `google_calendar_get_event`: read one event by id or by hint
- `google_calendar_update_event`: update an existing event
- `google_calendar_delete_event`: delete an existing event
- `google_calendar_list_upcoming_events`: list upcoming events in a bounded window
- `google_calendar_find_next_meeting`: answer questions like "what is my next meeting?"

## Operating Rules

1. Prefer read-only tools for informational requests.
2. For write actions, gather the minimum missing detail before calling a tool.
3. If the plugin asks for clarification, ask the user that follow-up instead of guessing.
4. If the plugin asks for confirmation, only retry the same write tool after the user confirms.
5. If the plugin is in read-only mode, explain that write actions are unavailable instead of retrying them.
6. If Google authorization is required, use the auth tools rather than asking the user for raw tokens or secrets.

## Event Reference Rules

When reading, updating, or deleting an event:

- use `eventId` when it is already known
- otherwise use `summaryHint`
- add `startHint` when the user gives a date or time that can narrow the search
- if multiple events could match, ask the user for a more specific start time or an `eventId`

Do not claim that a hint uniquely identifies an event unless the tool flow confirms it.

## Date And Time Rules

- For all-day events, use `date` in `YYYY-MM-DD` format.
- For timed events, use `dateTime`.
- If a timed value does not include a UTC offset, include `timeZone` when the user gives one.
- The plugin may apply its configured default time zone when the user does not specify one.
- When creating an event, the plugin can default the end time if the start is clear.

## Confirmation Rules

Write actions may require a second pass with `confirmed: true`.

- For create, update, or delete, do not set `confirmed: true` unless the user has already confirmed the action.
- If the tool returns a confirmation prompt, summarize the pending action for the user and ask for confirmation.
- After the user confirms, rerun the same tool with the same payload plus `confirmed: true`.

## Response Style

- Keep clarifying questions concise and practical.
- State missing details plainly.
- When an operation fails because of auth, config, ambiguity, or read-only mode, explain the blocker in simple language.
- Do not expose tokens, credential payloads, or other secrets in responses.
