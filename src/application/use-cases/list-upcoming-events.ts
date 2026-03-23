import type { ListUpcomingEventsCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import { blocked, ready } from "../../domain/clarification.js";

export interface ListUpcomingEventsInput {
  calendarId?: string;
  windowDays?: number;
  limit?: number;
  anchorTime?: string;
}

export function prepareListUpcomingEvents(
  input: ListUpcomingEventsInput,
  config: ResolvedGoogleCalendarPluginConfig,
): UseCaseResult<ListUpcomingEventsCommand> {
  const windowDays = input.windowDays ?? config.upcomingWindowDays;
  const limit = input.limit ?? 10;

  if (!Number.isInteger(windowDays) || windowDays < 1) {
    return blocked("windowDays must be a positive integer.");
  }

  if (!Number.isInteger(limit) || limit < 1) {
    return blocked("limit must be a positive integer.");
  }

  return ready({
    calendarId: normalizeOptionalString(input.calendarId) ?? config.defaultCalendarId,
    windowDays,
    limit,
    anchorTime: normalizeOptionalString(input.anchorTime),
  });
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return isBlank(value) ? undefined : value!.trim();
}
