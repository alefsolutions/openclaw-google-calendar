# OpenClaw Google Calendar Plugin

This repository is the foundation for an OpenClaw-specific Google Calendar plugin. Its purpose is to let OpenClaw manage a user's calendar through a complete plugin package that combines skills, tools, plugin-level configuration, and an installation flow suitable for OpenClaw.

The project is being designed for personal use first, with a structure that can later support reuse, packaging, and broader distribution. The first target is local-repository installation, so the plugin can be developed and tested directly in an OpenClaw environment before any registry publishing is considered.

## Purpose

This plugin is intended to give OpenClaw practical Google Calendar capabilities for everyday calendar management. Rather than acting as a single skill or a loose script collection, the goal is to build a real OpenClaw plugin repository that is organized, configurable, and ready to grow into a distributable package later.

The plugin is meant to be channel-agnostic. As long as OpenClaw routes the user instruction into the plugin, the behavior should remain consistent regardless of where the request originated.

## Intended Functionality

At a high level, the plugin is expected to support:

- creating calendar events
- reading calendar events
- updating calendar events
- deleting calendar events
- listing upcoming events
- answering questions such as "what is my next meeting?"
- clarifying ambiguous user requests before taking action
- handling missing details such as incomplete dates, times, attendees, locations, or other event metadata

Calendar event management is the primary focus. Task or to-do support may be considered later if it fits naturally with the Google integrations used by the plugin, but it is not the initial priority.

## Plugin Scope

This repository is intended to contain the building blocks of a complete OpenClaw plugin package, including:

- skills for user-facing instruction handling and clarification
- tools for the underlying Google Calendar operations
- plugin-level configuration for setup and runtime behavior
- an installation path suitable for local OpenClaw usage
- a repository structure that can later be packaged and distributed cleanly

The underlying tool scripts are planned to be written in Node.js so the plugin is straightforward to run, maintain, and extend in a typical JavaScript ecosystem.

## Configuration Direction

Configuration should stay practical and easy to reason about. The plugin will prefer clean setup patterns based on environment variables and plugin-level configuration, especially for items such as credentials, default calendar selection, timezone behavior, and local development settings.

Because this repository is being prepared as a real plugin project, secrets and machine-specific values should remain outside committed source whenever possible.

## Development Direction

The current focus is repository foundation, not full implementation. This stage is about defining the project clearly as an OpenClaw plugin and preparing the structure needed for the next steps.

Near-term priorities include:

- establishing the plugin package structure
- defining the OpenClaw-facing configuration surface
- implementing Node.js tool scripts for Google Calendar operations
- adding skills that can interpret user intent, ask clarifying questions, and call tools safely
- supporting local-repo installation for OpenClaw first

## Future Packaging Potential

Although this repository is not currently focused on publishing, it is being organized so it can later be adapted for packaging or distribution through channels such as ClawHub or npm if that becomes useful. For now, the goal is a solid local OpenClaw plugin that works well for personal use and is structured for reuse.
