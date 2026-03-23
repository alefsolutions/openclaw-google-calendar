# OpenClaw Google Calendar Plugin

This repository contains an OpenClaw-specific Google Calendar plugin. It is designed as a real plugin package, not just a script folder, and includes OpenClaw skills, agent tools, plugin-level configuration, and a local-repo installation path for OpenClaw.

The project is personal-use first, but it is structured so it can later be reused, packaged, and distributed more cleanly through channels such as ClawHub or npm if that becomes useful.

## Purpose

This plugin gives OpenClaw practical Google Calendar capabilities for day-to-day calendar management. It is meant to be channel-agnostic: as long as OpenClaw routes the instruction into the plugin, the behavior should remain consistent regardless of where the request originated.

## Current Scope

The plugin currently includes:

- OpenClaw tool registration for auth, event CRUD, upcoming-event listing, and next-meeting lookup
- a shipped skill for clarification, auth handoff, and safe tool usage
- plugin-level config resolution with environment-variable overrides
- Google OAuth token handling and Google Calendar API gateway wiring
- local-repository installation support for OpenClaw development

The underlying runtime is implemented in Node.js and organized as an OpenClaw-native plugin repository.

## Planned Capabilities

At a high level, the plugin is intended to support:

- creating calendar events
- reading calendar events
- updating calendar events
- deleting calendar events
- listing upcoming events
- answering questions such as "what is my next meeting?"
- clarifying ambiguous user requests before taking action
- handling missing details such as incomplete dates, times, attendees, locations, or other event metadata

Calendar event management is the primary focus. Task or to-do support may be considered later, but it is not the initial priority.

## Configuration

Configuration is designed to stay practical and predictable. The plugin uses plugin config plus environment variables for items such as:

- OAuth credentials and token file locations
- default calendar id
- default time zone
- confirmation mode
- upcoming-event window
- read-only mode

Machine-specific secrets should stay outside committed source files whenever possible.

Example config is available in [`examples/openclaw.config.example.jsonc`](./examples/openclaw.config.example.jsonc), and example environment overrides are available in [`.env.example`](./.env.example).

## Local Installation

Local-repo installation is the first target for this project.

The short version is:

1. Install dependencies in this repo with `npm install`.
2. Install the plugin into OpenClaw from the local folder with either:
   - `openclaw plugins install .`
   - `openclaw plugins install -l .` for a linked dev install
3. Restart the Gateway with `openclaw gateway restart`.
4. Configure the plugin under `plugins.entries.openclaw-google-calendar.config`.
5. Complete the Google auth flow with `google_calendar_begin_auth` and `google_calendar_complete_auth`.

Detailed setup instructions are in [`docs/local-install.md`](./docs/local-install.md).

## Development Notes

This repository is still in staged development, but it is no longer just a scaffold. The plugin now includes real runtime layers, auth wiring, Google Calendar gateway integration, clarification behavior, confirmation handling, and repository validation tests.

## Future Packaging Potential

This repository is not focused on publishing yet. The current goal is a solid local OpenClaw plugin that works well for personal use and remains structured for reuse later.
