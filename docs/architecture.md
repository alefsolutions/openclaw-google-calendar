# Architecture Notes

This repository follows the native OpenClaw plugin shape described in the OpenClaw plugin documentation:

- `openclaw.plugin.json` at the repository root for plugin metadata, skills, and config schema
- `package.json` with `openclaw.extensions` pointing at the plugin entry file
- `src/` for the Node.js and TypeScript runtime entrypoint plus future tool implementation
- `skills/` for plugin-shipped `SKILL.md` content

This scaffold is intentionally light. It establishes the folders and contracts needed for later Google Calendar work without adding OAuth, API calls, or production CRUD logic yet.
