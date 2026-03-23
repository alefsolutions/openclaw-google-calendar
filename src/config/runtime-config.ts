import { PluginConfigurationError } from "../shared/errors.js";

export type ConfirmationMode = "always" | "when-ambiguous" | "never";

export interface GoogleCalendarPluginConfig {
  credentialsPath?: string;
  tokenPath?: string;
  defaultCalendarId?: string;
  defaultTimeZone?: string;
  confirmationMode?: ConfirmationMode;
  upcomingWindowDays?: number;
  readOnlyMode?: boolean;
}

export interface ResolvedGoogleCalendarPluginConfig {
  credentialsPath?: string;
  tokenPath?: string;
  defaultCalendarId: string;
  defaultTimeZone?: string;
  confirmationMode: ConfirmationMode;
  upcomingWindowDays: number;
  readOnlyMode: boolean;
}

export interface GoogleCalendarRuntimeEnv {
  [key: string]: string | undefined;
}

export const googleCalendarEnvVars = {
  credentialsPath: "GOOGLE_CALENDAR_CREDENTIALS_PATH",
  tokenPath: "GOOGLE_CALENDAR_TOKEN_PATH",
  defaultCalendarId: "GOOGLE_CALENDAR_DEFAULT_CALENDAR_ID",
  defaultTimeZone: "GOOGLE_CALENDAR_DEFAULT_TIME_ZONE",
  confirmationMode: "GOOGLE_CALENDAR_CONFIRMATION_MODE",
  upcomingWindowDays: "GOOGLE_CALENDAR_UPCOMING_WINDOW_DAYS",
  readOnlyMode: "GOOGLE_CALENDAR_READ_ONLY_MODE",
} as const;

export const defaultGoogleCalendarPluginConfig: ResolvedGoogleCalendarPluginConfig = {
  defaultCalendarId: "primary",
  confirmationMode: "when-ambiguous",
  upcomingWindowDays: 7,
  readOnlyMode: false,
};

// Environment values override plugin config so local secrets can stay out of
// checked-in configuration when possible.
export function resolveGoogleCalendarPluginConfig(
  pluginConfig: GoogleCalendarPluginConfig = {},
  env: GoogleCalendarRuntimeEnv = getDefaultRuntimeEnv(),
): ResolvedGoogleCalendarPluginConfig {
  const confirmationMode = pickConfirmationMode(
    readEnv(env, googleCalendarEnvVars.confirmationMode),
    pluginConfig.confirmationMode,
  );
  const upcomingWindowDays = pickPositiveInteger(
    readEnv(env, googleCalendarEnvVars.upcomingWindowDays),
    pluginConfig.upcomingWindowDays,
    defaultGoogleCalendarPluginConfig.upcomingWindowDays,
    "upcomingWindowDays",
  );
  const readOnlyMode = pickBoolean(
    readEnv(env, googleCalendarEnvVars.readOnlyMode),
    pluginConfig.readOnlyMode,
    defaultGoogleCalendarPluginConfig.readOnlyMode,
    "readOnlyMode",
  );

  return {
    credentialsPath: pickString(
      readEnv(env, googleCalendarEnvVars.credentialsPath),
      pluginConfig.credentialsPath,
    ),
    tokenPath: pickString(readEnv(env, googleCalendarEnvVars.tokenPath), pluginConfig.tokenPath),
    defaultCalendarId:
      pickString(
        readEnv(env, googleCalendarEnvVars.defaultCalendarId),
        pluginConfig.defaultCalendarId,
      ) ?? defaultGoogleCalendarPluginConfig.defaultCalendarId,
    defaultTimeZone: pickString(
      readEnv(env, googleCalendarEnvVars.defaultTimeZone),
      pluginConfig.defaultTimeZone,
    ),
    confirmationMode,
    upcomingWindowDays,
    readOnlyMode,
  };
}

function readEnv(env: GoogleCalendarRuntimeEnv, key: string): string | undefined {
  return normalizeOptionalString(env[key]);
}

function pickString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const normalizedValue = normalizeOptionalString(value);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return undefined;
}

function pickConfirmationMode(
  envValue: string | undefined,
  configValue: ConfirmationMode | undefined,
): ConfirmationMode {
  const value = pickString(envValue, configValue);

  if (!value) {
    return defaultGoogleCalendarPluginConfig.confirmationMode;
  }

  if (value === "always" || value === "when-ambiguous" || value === "never") {
    return value;
  }

  throw new PluginConfigurationError(
    "confirmationMode must be one of: always, when-ambiguous, never.",
  );
}

function pickPositiveInteger(
  envValue: string | undefined,
  configValue: number | undefined,
  fallbackValue: number,
  fieldName: string,
): number {
  if (envValue) {
    const parsedValue = Number.parseInt(envValue, 10);

    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      throw new PluginConfigurationError(`${fieldName} must be a positive integer.`);
    }

    return parsedValue;
  }

  if (typeof configValue === "number") {
    if (!Number.isInteger(configValue) || configValue < 1) {
      throw new PluginConfigurationError(`${fieldName} must be a positive integer.`);
    }

    return configValue;
  }

  return fallbackValue;
}

function pickBoolean(
  envValue: string | undefined,
  configValue: boolean | undefined,
  fallbackValue: boolean,
  fieldName: string,
): boolean {
  if (envValue) {
    const loweredValue = envValue.toLowerCase();

    if (loweredValue === "true") {
      return true;
    }

    if (loweredValue === "false") {
      return false;
    }

    throw new PluginConfigurationError(`${fieldName} must be true or false.`);
  }

  if (typeof configValue === "boolean") {
    return configValue;
  }

  return fallbackValue;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

function getDefaultRuntimeEnv(): GoogleCalendarRuntimeEnv {
  const candidate = globalThis as {
    process?: {
      env?: GoogleCalendarRuntimeEnv;
    };
  };

  return candidate.process?.env ?? {};
}
