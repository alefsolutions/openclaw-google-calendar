import type { CalendarDateTimeValue } from "../domain/calendar-event.js";

export type CalendarDateTimeKind = "all-day" | "timed";

interface DateComparisonValue {
  mode: "date";
  value: string;
}

interface InstantComparisonValue {
  mode: "instant";
  value: number;
}

interface LocalComparisonValue {
  mode: "local";
  value: string;
  timeZone: string;
}

export interface NormalizedCalendarDateTime {
  kind: CalendarDateTimeKind;
  value: CalendarDateTimeValue;
  comparison: DateComparisonValue | InstantComparisonValue | LocalComparisonValue;
}

export type CalendarDateTimeNormalizationResult =
  | {
      status: "missing";
    }
  | {
      status: "invalid";
      reason: string;
    }
  | {
      status: "valid";
      value: NormalizedCalendarDateTime;
    };

export interface NormalizeCalendarDateTimeOptions {
  defaultTimeZone?: string;
  fieldLabel?: string;
}

export function normalizeCalendarDateTimeValue(
  input: CalendarDateTimeValue | undefined,
  options: NormalizeCalendarDateTimeOptions = {},
): CalendarDateTimeNormalizationResult {
  if (!input) {
    return {
      status: "missing",
    };
  }

  const date = normalizeOptionalString(input.date);
  const dateTime = normalizeOptionalString(input.dateTime);
  const explicitTimeZone = normalizeOptionalString(input.timeZone);
  const fieldLabel = options.fieldLabel ?? "calendar time value";

  if (!date && !dateTime) {
    return {
      status: "missing",
    };
  }

  if (date && dateTime) {
    return {
      status: "invalid",
      reason: `${capitalize(fieldLabel)} must use either date or dateTime, not both.`,
    };
  }

  if (explicitTimeZone && !isValidTimeZone(explicitTimeZone)) {
    return {
      status: "invalid",
      reason: `${capitalize(fieldLabel)} uses an invalid timeZone value.`,
    };
  }

  if (date) {
    if (!isIsoDate(date)) {
      return {
        status: "invalid",
        reason: `${capitalize(fieldLabel)} date must use YYYY-MM-DD.`,
      };
    }

    const timeZone = explicitTimeZone ?? options.defaultTimeZone;

    if (timeZone && !isValidTimeZone(timeZone)) {
      return {
        status: "invalid",
        reason: `${capitalize(fieldLabel)} uses an invalid timeZone value.`,
      };
    }

    return {
      status: "valid",
      value: {
        kind: "all-day",
        value: {
          date,
          timeZone,
        },
        comparison: {
          mode: "date",
          value: date,
        },
      },
    };
  }

  const hasExplicitOffset = hasUtcOffset(dateTime!);
  const timeZone = explicitTimeZone ?? (hasExplicitOffset ? undefined : options.defaultTimeZone);

  if (timeZone && !isValidTimeZone(timeZone)) {
    return {
      status: "invalid",
      reason: `${capitalize(fieldLabel)} uses an invalid timeZone value.`,
    };
  }

  if (hasExplicitOffset) {
    const instantValue = Date.parse(dateTime!);

    if (Number.isNaN(instantValue)) {
      return {
        status: "invalid",
        reason: `${capitalize(fieldLabel)} dateTime must be a valid ISO 8601 value.`,
      };
    }

    return {
      status: "valid",
      value: {
        kind: "timed",
        value: {
          dateTime: new Date(instantValue).toISOString(),
          timeZone,
        },
        comparison: {
          mode: "instant",
          value: instantValue,
        },
      },
    };
  }

  if (!timeZone) {
    return {
      status: "invalid",
      reason:
        `${capitalize(fieldLabel)} needs a timeZone when dateTime does not include a UTC offset.`,
    };
  }

  const normalizedLocalDateTime = normalizeLocalIsoDateTime(dateTime!);

  if (!normalizedLocalDateTime) {
    return {
      status: "invalid",
      reason: `${capitalize(fieldLabel)} dateTime must use a local ISO 8601 format such as 2026-03-24T09:00:00.`,
    };
  }

  return {
    status: "valid",
    value: {
      kind: "timed",
      value: {
        dateTime: normalizedLocalDateTime,
        timeZone,
      },
      comparison: {
        mode: "local",
        value: normalizedLocalDateTime,
        timeZone,
      },
    },
  };
}

export function createDefaultCalendarEventEnd(
  start: NormalizedCalendarDateTime,
): NormalizedCalendarDateTime {
  if (start.kind === "all-day") {
    return {
      kind: "all-day",
      value: {
        date: addDaysToIsoDate(start.value.date!, 1),
        timeZone: start.value.timeZone,
      },
      comparison: {
        mode: "date",
        value: addDaysToIsoDate(start.value.date!, 1),
      },
    };
  }

  if (start.comparison.mode === "instant") {
    const endDateTime = new Date(start.comparison.value + 60 * 60 * 1000).toISOString();

    return {
      kind: "timed",
      value: {
        dateTime: endDateTime,
        timeZone: start.value.timeZone,
      },
      comparison: {
        mode: "instant",
        value: Date.parse(endDateTime),
      },
    };
  }

  const endDateTime = addHoursToLocalIsoDateTime(start.comparison.value, 1);

  return {
    kind: "timed",
    value: {
      dateTime: endDateTime,
      timeZone: start.value.timeZone,
    },
    comparison: {
      mode: "local",
      value: endDateTime,
      timeZone: start.value.timeZone!,
    },
  };
}

export function compareNormalizedCalendarDateTimes(
  start: NormalizedCalendarDateTime,
  end: NormalizedCalendarDateTime,
): number | null {
  if (start.kind !== end.kind) {
    return null;
  }

  if (start.comparison.mode === "date" && end.comparison.mode === "date") {
    return start.comparison.value.localeCompare(end.comparison.value);
  }

  if (start.comparison.mode === "instant" && end.comparison.mode === "instant") {
    return start.comparison.value - end.comparison.value;
  }

  if (start.comparison.mode === "local" && end.comparison.mode === "local") {
    if (start.comparison.timeZone !== end.comparison.timeZone) {
      return null;
    }

    return start.comparison.value.localeCompare(end.comparison.value);
  }

  return null;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeLocalIsoDateTime(value: string): string | undefined {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?$/,
  );

  if (!match) {
    return undefined;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const second = Number.parseInt(match[6] ?? "0", 10);
  const millisecond = Number.parseInt((match[7] ?? ".000").slice(1).padEnd(3, "0"), 10);

  if (!isValidDateParts(year, month, day)) {
    return undefined;
  }

  if (hour > 23 || minute > 59 || second > 59 || millisecond > 999) {
    return undefined;
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${String(second).padStart(2, "0")}.${String(millisecond).padStart(3, "0")}`;
}

function hasUtcOffset(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
}

function isIsoDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  return isValidDateParts(
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  );
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function addDaysToIsoDate(value: string, dayCount: number): string {
  const candidate = new Date(`${value}T00:00:00.000Z`);
  candidate.setUTCDate(candidate.getUTCDate() + dayCount);
  return candidate.toISOString().slice(0, 10);
}

function addHoursToLocalIsoDateTime(value: string, hourCount: number): string {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map((part) => Number.parseInt(part, 10));
  const [hourPart, minutePart, secondPart] = timePart.split(":");
  const secondParts = secondPart.split(".");
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10);
  const second = Number.parseInt(secondParts[0], 10);
  const millisecond = Number.parseInt((secondParts[1] ?? "000").padEnd(3, "0"), 10);
  const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  candidate.setUTCHours(candidate.getUTCHours() + hourCount);

  return [
    candidate.toISOString().slice(0, 10),
    "T",
    candidate.toISOString().slice(11, 23),
  ].join("");
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
