---
name: google-calendar-assistant
description: Help OpenClaw manage Google Calendar requests by clarifying missing details and using this plugin's calendar tools when they are available.
metadata: {"openclaw":{"requires":{"config":["plugins.entries.openclaw-google-calendar.enabled"]}}}
---

Use this skill when the user wants OpenClaw to work with Google Calendar.

The skill should:

- help with event creation, reading, updates, deletion, and upcoming-event questions
- ask follow-up questions when dates, times, attendees, locations, or calendar targets are unclear
- avoid assuming destructive changes are safe when a request is ambiguous
- prefer the plugin's Google Calendar tools once they are implemented and available
- explain clearly when the plugin is installed as a scaffold but the requested runtime action is not implemented yet

When gathering details, prefer concise clarifications that unblock execution quickly.
