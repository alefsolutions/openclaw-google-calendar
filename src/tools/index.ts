import type {
  OpenClawPluginApi,
  OpenClawToolDefinition,
  OpenClawToolResult,
} from "openclaw/plugin-sdk/plugin-entry";

import type {
  CalendarGateway,
  CreateCalendarEventCommand,
  DeleteCalendarEventCommand,
  FindNextMeetingCommand,
  GetCalendarEventCommand,
  ListUpcomingEventsCommand,
  UpdateCalendarEventCommand,
} from "../application/ports/calendar-gateway.js";
import {
  prepareCreateCalendarEvent,
  prepareDeleteCalendarEvent,
  prepareFindNextMeeting,
  prepareGetCalendarEvent,
  prepareListUpcomingEvents,
  prepareUpdateCalendarEvent,
} from "../application/use-cases/index.js";
import type {
  GoogleCalendarPluginConfig,
  ResolvedGoogleCalendarPluginConfig,
} from "../config/runtime-config.js";
import { resolveGoogleCalendarPluginConfig } from "../config/runtime-config.js";
import type { CalendarDateTimeValue, CalendarEvent } from "../domain/calendar-event.js";
import type { UseCaseResult } from "../domain/clarification.js";
import {
  createGoogleCalendarAuthService,
  type GoogleCalendarAuthService,
} from "../infrastructure/google/google-calendar-auth.js";
import type { GoogleCalendarClient } from "../infrastructure/google/google-calendar-client.js";
import { createGoogleCalendarGateway } from "../infrastructure/google/google-calendar-gateway.js";
import {
  AmbiguousCalendarEventReferenceError,
  AuthenticationRequiredError,
  NotImplementedYetError,
  PluginConfigurationError,
  ResourceNotFoundError,
} from "../shared/errors.js";
import { googleCalendarToolCatalog } from "./planned-tools.js";

export interface GoogleCalendarToolDependencies {
  authServiceFactory?: (
    config: ResolvedGoogleCalendarPluginConfig,
  ) => GoogleCalendarAuthService;
  gatewayFactory?: (
    client: GoogleCalendarClient,
    config: ResolvedGoogleCalendarPluginConfig,
  ) => CalendarGateway;
}

export function registerGoogleCalendarTools(
  api: OpenClawPluginApi,
  dependencies: GoogleCalendarToolDependencies = {},
): void {
  if (!api.registerTool) {
    return;
  }

  for (const tool of buildGoogleCalendarToolDefinitions(api, dependencies)) {
    api.registerTool(tool, { optional: true });
  }
}

function buildGoogleCalendarToolDefinitions(
  api: OpenClawPluginApi,
  dependencies: GoogleCalendarToolDependencies,
): Array<OpenClawToolDefinition> {
  return [
    {
      name: googleCalendarToolCatalog.beginAuth.name,
      description: googleCalendarToolCatalog.beginAuth.description,
      parameters: emptyObjectSchema,
      execute: async () => {
        const config = getResolvedPluginConfig(api);
        const authService = createToolAuthService(config, dependencies);
        const authorizationRequest = await authService.createAuthorizationUrl();

        return textResult(formatAuthorizationRequest(authorizationRequest));
      },
    },
    {
      name: googleCalendarToolCatalog.completeAuth.name,
      description: googleCalendarToolCatalog.completeAuth.description,
      parameters: completeAuthSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const authService = createToolAuthService(config, dependencies);
        const authorizationCode = getAuthorizationCode(params);

        if (!authorizationCode) {
          return textResult(
            "I need the Google authorization code before I can complete authentication.",
          );
        }

        const tokenMetadata = await authService.exchangeCodeForToken(authorizationCode);

        return textResult(formatStoredTokenMetadata(tokenMetadata));
      },
    },
    {
      name: googleCalendarToolCatalog.createEvent.name,
      description: googleCalendarToolCatalog.createEvent.description,
      parameters: createEventSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const result = prepareCreateCalendarEvent(
          params as Parameters<typeof prepareCreateCalendarEvent>[0],
          config,
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          config,
          "create a calendar event",
          result,
          (gateway, command) => gateway.createEvent(command),
          (event) => `Created calendar event:\n${formatEventDetails(event)}`,
        );
      },
    },
    {
      name: googleCalendarToolCatalog.getEvent.name,
      description: googleCalendarToolCatalog.getEvent.description,
      parameters: eventReferenceInputSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareGetCalendarEvent(
          params as Parameters<typeof prepareGetCalendarEvent>[0],
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          getResolvedPluginConfig(api),
          "read a calendar event",
          result,
          (gateway, command) => gateway.getEvent(command),
          (event) =>
            event
              ? `Calendar event:\n${formatEventDetails(event)}`
              : "I could not find a matching calendar event.",
        );
      },
    },
    {
      name: googleCalendarToolCatalog.updateEvent.name,
      description: googleCalendarToolCatalog.updateEvent.description,
      parameters: updateEventSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const result = prepareUpdateCalendarEvent(
          params as Parameters<typeof prepareUpdateCalendarEvent>[0],
          config,
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          config,
          "update a calendar event",
          result,
          (gateway, command) => gateway.updateEvent(command),
          (event) => `Updated calendar event:\n${formatEventDetails(event)}`,
        );
      },
    },
    {
      name: googleCalendarToolCatalog.deleteEvent.name,
      description: googleCalendarToolCatalog.deleteEvent.description,
      parameters: eventReferenceInputSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const result = prepareDeleteCalendarEvent(
          params as Parameters<typeof prepareDeleteCalendarEvent>[0],
          config,
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          config,
          "delete a calendar event",
          result,
          async (gateway, command) => {
            await gateway.deleteEvent(command);
            return command;
          },
          (command) => formatDeleteSuccessMessage(command, config.defaultCalendarId),
        );
      },
    },
    {
      name: googleCalendarToolCatalog.listUpcomingEvents.name,
      description: googleCalendarToolCatalog.listUpcomingEvents.description,
      parameters: listUpcomingEventsSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const result = prepareListUpcomingEvents(
          params as Parameters<typeof prepareListUpcomingEvents>[0],
          config,
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          config,
          "list upcoming calendar events",
          result,
          (gateway, command) => gateway.listUpcomingEvents(command),
          (events, command) => formatUpcomingEvents(events, command),
        );
      },
    },
    {
      name: googleCalendarToolCatalog.findNextMeeting.name,
      description: googleCalendarToolCatalog.findNextMeeting.description,
      parameters: findNextMeetingSchema,
      execute: async (_toolCallId, params) => {
        const config = getResolvedPluginConfig(api);
        const result = prepareFindNextMeeting(
          params as Parameters<typeof prepareFindNextMeeting>[0],
          config,
        );

        return executePreparedGatewayAction(
          api,
          dependencies,
          config,
          "find the next meeting",
          result,
          (gateway, command) => gateway.findNextMeeting(command),
          (event) =>
            event
              ? `Your next meeting is:\n${formatEventDetails(event)}`
              : "I could not find an upcoming meeting.",
        );
      },
    },
  ];
}

async function executePreparedGatewayAction<TCommand, TValue>(
  api: OpenClawPluginApi,
  dependencies: GoogleCalendarToolDependencies,
  config: ResolvedGoogleCalendarPluginConfig,
  actionLabel: string,
  result: UseCaseResult<TCommand>,
  executeReady: (gateway: CalendarGateway, command: TCommand) => Promise<TValue>,
  formatSuccess: (value: TValue, command: TCommand) => string,
): Promise<OpenClawToolResult> {
  if (result.status !== "ready") {
    return formatEarlyUseCaseResult(actionLabel, result);
  }

  const command = result.value;
  const authService = createToolAuthService(config, dependencies);

  try {
    const gateway = await createToolGateway(authService, config, dependencies);
    const value = await executeReady(gateway, command);

    return textResult(formatSuccess(value, command));
  } catch (error) {
    return await formatExecutionError(error, actionLabel, authService);
  }
}

function formatEarlyUseCaseResult(
  actionLabel: string,
  result: Exclude<UseCaseResult<unknown>, { status: "ready"; value: unknown }>,
): OpenClawToolResult {
  if (result.status === "needs-clarification") {
    return textResult(
      [
        `I need a bit more detail before I can ${actionLabel}:`,
        ...result.items.map((item, index) => `${index + 1}. ${item.question}`),
      ].join("\n"),
    );
  }

  if (result.status === "blocked") {
    return textResult(`I cannot ${actionLabel}: ${result.reason}`);
  }

  if (result.status === "not-implemented") {
    return textResult(result.reason);
  }

  return textResult(`I cannot ${actionLabel} for an unknown reason.`);
}

async function formatExecutionError(
  error: unknown,
  actionLabel: string,
  authService: GoogleCalendarAuthService,
): Promise<OpenClawToolResult> {
  if (error instanceof AmbiguousCalendarEventReferenceError) {
    return textResult(formatAmbiguousReferenceMessage(actionLabel, error));
  }

  if (error instanceof AuthenticationRequiredError) {
    try {
      const authorizationRequest = await authService.createAuthorizationUrl();

      return textResult(
        [
          `Google Calendar authorization is required before I can ${actionLabel}.`,
          `Open this URL in your browser: ${authorizationRequest.authorizationUrl}`,
          "After Google returns an authorization code, run google_calendar_complete_auth with that code.",
        ].join("\n"),
      );
    } catch {
      return textResult(`I cannot ${actionLabel}: ${error.message}`);
    }
  }

  if (error instanceof ResourceNotFoundError) {
    return textResult(error.message);
  }

  if (error instanceof PluginConfigurationError || error instanceof NotImplementedYetError) {
    return textResult(`I cannot ${actionLabel}: ${error.message}`);
  }

  return textResult(
    `I could not ${actionLabel} because Google Calendar returned an unexpected error.`,
  );
}

async function createToolGateway(
  authService: GoogleCalendarAuthService,
  config: ResolvedGoogleCalendarPluginConfig,
  dependencies: GoogleCalendarToolDependencies,
): Promise<CalendarGateway> {
  const client = await authService.createAuthenticatedCalendarClient();

  return (
    dependencies.gatewayFactory?.(client, config) ??
    createGoogleCalendarGateway(client, {
      defaultCalendarId: config.defaultCalendarId,
    })
  );
}

function createToolAuthService(
  config: ResolvedGoogleCalendarPluginConfig,
  dependencies: GoogleCalendarToolDependencies,
): GoogleCalendarAuthService {
  return (
    dependencies.authServiceFactory?.(config) ?? createGoogleCalendarAuthService(config)
  );
}

function getResolvedPluginConfig(api: OpenClawPluginApi) {
  return resolveGoogleCalendarPluginConfig(getPluginConfig(api.config));
}

function getPluginConfig(runtimeConfig: unknown): GoogleCalendarPluginConfig {
  if (!runtimeConfig || typeof runtimeConfig !== "object" || Array.isArray(runtimeConfig)) {
    return {};
  }

  const configRoot = runtimeConfig as {
    plugins?: {
      entries?: Record<
        string,
        {
          config?: unknown;
        }
      >;
    };
  };

  const pluginConfig = configRoot.plugins?.entries?.["openclaw-google-calendar"]?.config;

  if (!pluginConfig || typeof pluginConfig !== "object" || Array.isArray(pluginConfig)) {
    return {};
  }

  return pluginConfig as GoogleCalendarPluginConfig;
}

function textResult(text: string): OpenClawToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function formatAuthorizationRequest(request: {
  authorizationUrl: string;
  redirectUri: string;
  scopes: readonly string[];
}): string {
  return [
    "Open this URL to authorize Google Calendar access:",
    request.authorizationUrl,
    `Redirect URI: ${request.redirectUri}`,
    `Scopes: ${request.scopes.join(", ")}`,
  ].join("\n");
}

function formatStoredTokenMetadata(metadata: {
  tokenPath: string;
  hasRefreshToken: boolean;
  scope?: string;
  expiryDate?: number;
}): string {
  return [
    "Google Calendar authentication is complete.",
    `Token path: ${metadata.tokenPath}`,
    `Refresh token stored: ${metadata.hasRefreshToken ? "yes" : "no"}`,
    metadata.scope ? `Granted scopes: ${metadata.scope}` : undefined,
    metadata.expiryDate ? `Expiry date: ${new Date(metadata.expiryDate).toISOString()}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function formatEventDetails(event: CalendarEvent): string {
  return [
    `Summary: ${event.summary}`,
    `Calendar: ${event.calendarId}`,
    `Event ID: ${event.id}`,
    `Start: ${formatCalendarDateTime(event.start)}`,
    `End: ${formatCalendarDateTime(event.end)}`,
    event.location ? `Location: ${event.location}` : undefined,
    event.description ? `Description: ${event.description}` : undefined,
    event.htmlLink ? `Link: ${event.htmlLink}` : undefined,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function formatUpcomingEvents(
  events: CalendarEvent[],
  command: ListUpcomingEventsCommand,
): string {
  if (events.length === 0) {
    return `I could not find any upcoming events in calendar ${command.calendarId} for the next ${command.windowDays} day(s).`;
  }

  return [
    `Upcoming events in calendar ${command.calendarId}:`,
    ...events.map(
      (event, index) =>
        `${index + 1}. ${event.summary} | Start: ${formatCalendarDateTime(event.start)} | End: ${formatCalendarDateTime(event.end)} | Event ID: ${event.id}`,
    ),
  ].join("\n");
}

function formatCalendarDateTime(value: CalendarDateTimeValue): string {
  if (value.dateTime) {
    return value.timeZone ? `${value.dateTime} (${value.timeZone})` : value.dateTime;
  }

  if (value.date) {
    return value.timeZone ? `${value.date} (${value.timeZone})` : value.date;
  }

  return "(unspecified)";
}

function formatDeleteSuccessMessage(
  command: DeleteCalendarEventCommand,
  defaultCalendarId: string,
): string {
  const calendarId = command.reference.calendarId ?? defaultCalendarId;

  if (command.reference.eventId) {
    return `Deleted calendar event ${command.reference.eventId} from calendar ${calendarId}.`;
  }

  if (command.reference.summaryHint) {
    return `Deleted the calendar event matching "${command.reference.summaryHint}" from calendar ${calendarId}.`;
  }

  if (command.reference.startHint) {
    return `Deleted the calendar event that matched ${command.reference.startHint} from calendar ${calendarId}.`;
  }

  return `Deleted the requested calendar event from calendar ${calendarId}.`;
}

function formatAmbiguousReferenceMessage(
  actionLabel: string,
  error: AmbiguousCalendarEventReferenceError,
): string {
  return [
    `I found more than one possible event for this request, so I cannot ${actionLabel} safely.`,
    "Please retry with an eventId or a more specific startHint.",
    ...error.candidates.map(
      (candidate, index) =>
        `${index + 1}. ${candidate.summary} | Start: ${candidate.start ?? "(unspecified)"} | Event ID: ${candidate.id} | Calendar: ${candidate.calendarId}`,
    ),
  ].join("\n");
}

function getAuthorizationCode(params: unknown): string | undefined {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }

  const authorizationCode = (params as { authorizationCode?: unknown }).authorizationCode;

  return typeof authorizationCode === "string" && authorizationCode.trim().length > 0
    ? authorizationCode.trim()
    : undefined;
}

const emptyObjectSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
};

const completeAuthSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    authorizationCode: {
      type: "string",
      description: "Authorization code returned by Google after the user grants consent.",
    },
  },
  required: ["authorizationCode"],
};

const calendarDateTimeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: {
      type: "string",
      description: "All-day date in YYYY-MM-DD format.",
    },
    dateTime: {
      type: "string",
      description: "Date-time in ISO 8601 format.",
    },
    timeZone: {
      type: "string",
      description: "IANA timezone name such as America/Los_Angeles.",
    },
  },
};

const attendeeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    email: {
      type: "string",
      description: "Attendee email address.",
    },
    displayName: {
      type: "string",
      description: "Optional attendee display name.",
    },
  },
  required: ["email"],
};

const eventReferenceInputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reference: {
      type: "object",
      additionalProperties: false,
      properties: {
        eventId: {
          type: "string",
          description: "Google Calendar event id if already known.",
        },
        summaryHint: {
          type: "string",
          description: "Natural-language summary hint for lookup.",
        },
        startHint: {
          type: "string",
          description: "Optional date or date-time hint to narrow event lookup.",
        },
        calendarId: {
          type: "string",
          description: "Calendar id to search in. Defaults to plugin config.",
        },
      },
    },
  },
};

const createEventSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    calendarId: {
      type: "string",
      description: "Target calendar id. Defaults to plugin config.",
    },
    summary: {
      type: "string",
      description: "Event title.",
    },
    description: {
      type: "string",
      description: "Optional event description.",
    },
    location: {
      type: "string",
      description: "Optional event location.",
    },
    start: calendarDateTimeSchema,
    end: calendarDateTimeSchema,
    attendees: {
      type: "array",
      items: attendeeSchema,
    },
  },
};

const updateEventSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reference: eventReferenceInputSchema.properties.reference,
    changes: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: {
          type: "string",
          description: "New event title.",
        },
        description: {
          type: "string",
          description: "New event description.",
        },
        location: {
          type: "string",
          description: "New event location.",
        },
        start: calendarDateTimeSchema,
        end: calendarDateTimeSchema,
        attendees: {
          type: "array",
          items: attendeeSchema,
        },
      },
    },
  },
};

const listUpcomingEventsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    calendarId: {
      type: "string",
      description: "Calendar id to search in. Defaults to plugin config.",
    },
    windowDays: {
      type: "integer",
      description: "Number of days to search forward.",
    },
    limit: {
      type: "integer",
      description: "Maximum number of events to return.",
    },
    anchorTime: {
      type: "string",
      description: "Optional ISO 8601 time to search from instead of now.",
    },
  },
};

const findNextMeetingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    calendarId: {
      type: "string",
      description: "Calendar id to search in. Defaults to plugin config.",
    },
    anchorTime: {
      type: "string",
      description: "Optional ISO 8601 time to search from instead of now.",
    },
  },
};
