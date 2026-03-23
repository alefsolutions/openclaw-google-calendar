import type { FindNextMeetingCommand } from "../ports/calendar-gateway.js";
import type { ResolvedGoogleCalendarPluginConfig } from "../../config/runtime-config.js";
import type { UseCaseResult } from "../../domain/clarification.js";
import { ready } from "../../domain/clarification.js";

export interface FindNextMeetingInput {
  calendarId?: string;
  anchorTime?: string;
}

export function prepareFindNextMeeting(
  input: FindNextMeetingInput,
  config: ResolvedGoogleCalendarPluginConfig,
): UseCaseResult<FindNextMeetingCommand> {
  return ready({
    calendarId: normalizeOptionalString(input.calendarId) ?? config.defaultCalendarId,
    anchorTime: normalizeOptionalString(input.anchorTime),
  });
}

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return isBlank(value) ? undefined : value!.trim();
}
