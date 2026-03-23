# Architecture Notes

This document defines the implementation shape we will follow as the OpenClaw Google Calendar plugin moves from scaffold to working code. The goal is to keep the plugin secure, readable, and easy to extend while staying aligned with OpenClaw's native plugin model.

## OpenClaw Plugin Shape

The repository follows the native OpenClaw plugin layout:

- `openclaw.plugin.json` at the root for plugin metadata, config schema, and skill discovery
- `package.json` with `openclaw.extensions` pointing at the runtime entrypoint
- `skills/` for plugin-shipped `SKILL.md` content
- `src/` for the runtime code loaded by OpenClaw

This split matters because OpenClaw reads manifest metadata before plugin code is loaded. Runtime behavior belongs in `src/`, while validation and install-time discovery belong in the manifest.

## Layered Runtime Design

The runtime is organized into clear layers so each part has one job.

### 1. OpenClaw Layer

Files in this layer wire the plugin into OpenClaw:

- `src/index.ts`
- `src/tools/`

Responsibilities:

- expose the native plugin entrypoint
- register tool definitions when each stage is ready
- keep OpenClaw-specific wiring separate from business rules

### 2. Application Layer

Files in this layer coordinate plugin behavior:

- `src/application/ports/`
- `src/application/use-cases/`

Responsibilities:

- prepare commands for calendar operations
- enforce clarification before unsafe or incomplete actions
- keep CRUD workflows readable and testable
- depend on interfaces instead of direct Google API code

### 3. Domain Layer

Files in this layer define the core language of the plugin:

- `src/domain/`

Responsibilities:

- describe calendar events, attendee data, and event references
- model clarification requests and structured use-case results
- keep shared rules free from OpenClaw or Google SDK details

### 4. Infrastructure Layer

Files in this layer deal with external systems:

- `src/config/`
- `src/infrastructure/`

Responsibilities:

- resolve config from plugin settings and environment variables
- isolate Google Calendar API integration
- keep auth, token storage, and HTTP details out of the domain layer

### 5. Shared Support Layer

Files in this layer hold small cross-cutting helpers:

- `src/shared/`

Responsibilities:

- common error types
- safe, reusable helpers that do not belong to one feature area

## Request Flow

The intended request flow is:

1. OpenClaw routes a calendar request into the plugin skill or tool.
2. The tool layer validates the tool input shape.
3. The application layer prepares the requested action.
4. If required details are missing, the application layer returns a clarification result instead of guessing.
5. When the request is safe and complete, the infrastructure layer performs the Google Calendar call.
6. The tool layer formats the final response back to OpenClaw.

This flow keeps ambiguity handling in one place and keeps API calls from happening too early.

## Security Rules

Security is a first-class requirement for this plugin.

- secrets must not be hard-coded in source files
- environment variables and local config should be preferred for sensitive paths and credentials
- logs and error messages must avoid exposing tokens, secrets, or raw credential payloads
- write operations should be blocked in read-only mode
- destructive or ambiguous changes should require clarification before execution
- the Google integration should request the narrowest practical scopes during OAuth work
- validation should happen before any network call is attempted

## Code Style Rules

The code should stay easy for a human to read:

- use small files with one clear purpose
- keep function names descriptive
- prefer plain data objects over clever abstractions
- add short comments in simple English only where they genuinely help
- keep Google-specific code out of the OpenClaw entry layer

## Planned Implementation Stages

We will build this plugin in stages so each stage remains testable and safe.

### Stage 1: Core Foundations

- typed config resolution
- domain models
- clarification result types
- use-case preparation logic
- infrastructure placeholders without live Google calls

### Stage 2: Read-Only Calendar Operations

- list upcoming events
- get event details
- answer "what is my next meeting?"
- safe formatting of calendar results

### Stage 3: Mutating Calendar Operations

- create events
- update events
- delete events
- confirmation behavior for destructive or ambiguous requests

### Stage 4: Auth and Operational Hardening

- OAuth flow
- token storage strategy
- retry and error handling
- redaction and logging rules

### Stage 5: Packaging and Validation

- test coverage
- install validation
- local development polish
- future packaging readiness

## Current Status

The repository now contains the foundation for each layer, but it still intentionally avoids real Google API calls. That lets us shape the architecture and pure logic first before we add sensitive auth and network behavior.
