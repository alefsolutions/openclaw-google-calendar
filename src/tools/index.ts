import type {
  OpenClawPluginApi,
  OpenClawToolDefinition,
  OpenClawToolResult,
} from "openclaw/plugin-sdk/plugin-entry";

import type { GoogleCalendarPluginConfig } from "../config/runtime-config.js";
import {
  resolveGoogleCalendarPluginConfig,
} from "../config/runtime-config.js";
import type { UseCaseResult } from "../domain/clarification.js";
import {
  prepareCreateCalendarEvent,
  prepareDeleteCalendarEvent,
  prepareFindNextMeeting,
  prepareGetCalendarEvent,
  prepareListUpcomingEvents,
  prepareUpdateCalendarEvent,
} from "../application/use-cases/index.js";
import { googleCalendarToolCatalog } from "./planned-tools.js";

export function registerGoogleCalendarTools(api: OpenClawPluginApi): void {
  if (!api.registerTool) {
    return;
  }

  for (const tool of buildGoogleCalendarToolDefinitions(api)) {
    api.registerTool(tool, { optional: true });
  }
}

function buildGoogleCalendarToolDefinitions(
  api: OpenClawPluginApi,
): Array<OpenClawToolDefinition> {
  return [
    {
      name: googleCalendarToolCatalog.createEvent.name,
      description: googleCalendarToolCatalog.createEvent.description,
      parameters: createEventSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareCreateCalendarEvent(
          params as Parameters<typeof prepareCreateCalendarEvent>[0],
          getResolvedPluginConfig(api),
        );

        return formatToolResult("create a calendar event", result);
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

        return formatToolResult("read a calendar event", result);
      },
    },
    {
      name: googleCalendarToolCatalog.updateEvent.name,
      description: googleCalendarToolCatalog.updateEvent.description,
      parameters: updateEventSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareUpdateCalendarEvent(
          params as Parameters<typeof prepareUpdateCalendarEvent>[0],
          getResolvedPluginConfig(api),
        );

        return formatToolResult("update a calendar event", result);
      },
    },
    {
      name: googleCalendarToolCatalog.deleteEvent.name,
      description: googleCalendarToolCatalog.deleteEvent.description,
      parameters: eventReferenceInputSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareDeleteCalendarEvent(
          params as Parameters<typeof prepareDeleteCalendarEvent>[0],
          getResolvedPluginConfig(api),
        );

        return formatToolResult("delete a calendar event", result);
      },
    },
    {
      name: googleCalendarToolCatalog.listUpcomingEvents.name,
      description: googleCalendarToolCatalog.listUpcomingEvents.description,
      parameters: listUpcomingEventsSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareListUpcomingEvents(
          params as Parameters<typeof prepareListUpcomingEvents>[0],
          getResolvedPluginConfig(api),
        );

        return formatToolResult("list upcoming calendar events", result);
      },
    },
    {
      name: googleCalendarToolCatalog.findNextMeeting.name,
      description: googleCalendarToolCatalog.findNextMeeting.description,
      parameters: findNextMeetingSchema,
      execute: async (_toolCallId, params) => {
        const result = prepareFindNextMeeting(
          params as Parameters<typeof prepareFindNextMeeting>[0],
          getResolvedPluginConfig(api),
        );

        return formatToolResult("find the next meeting", result);
      },
    },
  ];
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

function formatToolResult(
  actionLabel: string,
  result: UseCaseResult<unknown>,
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

  return textResult(
    `Validation for ${actionLabel} passed, but the Google Calendar backend is not implemented yet.`,
  );
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
