import {
  AuthenticationRequiredError,
  ExternalServiceError,
  NotImplementedYetError,
  PluginConfigurationError,
  ResourceNotFoundError,
  ValidationError,
} from "./errors.js";

export interface NormalizeGoogleCalendarErrorOptions {
  actionLabel: string;
  phase?: "authorization-url" | "token-exchange" | "calendar-api";
}

const networkErrorCodes = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

const oauthReauthorizationReasons = new Set([
  "access_denied",
  "accessdenied",
  "autherror",
  "invalidcredentials",
  "invalid_grant",
  "invalidgrant",
  "unauthorized",
]);

const permissionReasonsRequiringAuth = new Set([
  "autherror",
  "forbidden",
  "insufficientauthentication",
  "insufficientpermissions",
  "invalidcredentials",
  "required",
]);

const rateLimitReasons = new Set([
  "quotaexceeded",
  "ratelimitexceeded",
  "toomanyrequests",
  "userratelimitexceeded",
]);

export function normalizeGoogleCalendarError(
  error: unknown,
  options: NormalizeGoogleCalendarErrorOptions,
): Error {
  if (isKnownSafeError(error)) {
    return error;
  }

  if (isNetworkError(error)) {
    return new ExternalServiceError(
      "I could not reach Google Calendar right now. Please check the connection and try again.",
    );
  }

  const status = getErrorStatus(error);
  const reasons = getErrorReasons(error);

  if (shouldRequireFreshAuthorization(error, reasons, options.phase)) {
    if (options.phase === "token-exchange") {
      return new AuthenticationRequiredError(
        "Google rejected the authorization code. Start the authorization flow again and use a fresh code.",
      );
    }

    return new AuthenticationRequiredError(
      "Google Calendar authentication is missing, expired, or no longer valid. Reauthorize the plugin and try again.",
    );
  }

  if (status === 403 && reasons.some((reason) => permissionReasonsRequiringAuth.has(reason))) {
    return new AuthenticationRequiredError(
      "Google Calendar access for this action is missing or out of date. Reauthorize the plugin and try again.",
    );
  }

  if (status === 403) {
    return new ExternalServiceError(
      "Google Calendar denied access to that request. Check calendar permissions and try again.",
    );
  }

  if (status === 429 || reasons.some((reason) => rateLimitReasons.has(reason))) {
    return new ExternalServiceError(
      "Google Calendar is rate limiting requests right now. Please wait a moment and try again.",
    );
  }

  if (status !== undefined && status >= 500) {
    return new ExternalServiceError(
      "Google Calendar is temporarily unavailable right now. Please try again in a few minutes.",
    );
  }

  return new ExternalServiceError(
    `Google Calendar returned an unexpected error while trying to ${options.actionLabel}.`,
  );
}

export function redactSensitiveText(value: string): string {
  return value
    .replace(/\b(access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b(code|authorization[_-]?code)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [redacted]");
}

function shouldRequireFreshAuthorization(
  error: unknown,
  reasons: string[],
  phase: NormalizeGoogleCalendarErrorOptions["phase"],
): boolean {
  const sanitizedMessage = extractGoogleErrorMessage(error).toLowerCase();

  if (reasons.some((reason) => oauthReauthorizationReasons.has(reason))) {
    return true;
  }

  if (
    sanitizedMessage.includes("invalid_grant") ||
    sanitizedMessage.includes("invalid credentials") ||
    sanitizedMessage.includes("invalid_credentials") ||
    sanitizedMessage.includes("expired") ||
    sanitizedMessage.includes("revoked")
  ) {
    return true;
  }

  if (phase === "token-exchange" && sanitizedMessage.includes("authorization code")) {
    return true;
  }

  return getErrorStatus(error) === 401;
}

function isKnownSafeError(error: unknown): error is Error {
  return (
    error instanceof AuthenticationRequiredError ||
    error instanceof ExternalServiceError ||
    error instanceof NotImplementedYetError ||
    error instanceof PluginConfigurationError ||
    error instanceof ResourceNotFoundError ||
    error instanceof ValidationError
  );
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const candidate = error as {
    code?: number | string;
    status?: number | string;
    response?: {
      status?: number | string;
    };
  };

  for (const value of [
    candidate.code,
    candidate.status,
    candidate.response?.status,
  ]) {
    const parsedValue = typeof value === "string" ? Number.parseInt(value, 10) : value;

    if (typeof parsedValue === "number" && Number.isInteger(parsedValue)) {
      return parsedValue;
    }
  }

  return undefined;
}

function getErrorReasons(error: unknown): string[] {
  if (!error || typeof error !== "object") {
    return [];
  }

  const candidate = error as {
    errors?: Array<{ reason?: unknown }>;
    response?: {
      data?: {
        error?: {
          errors?: Array<{ reason?: unknown }>;
        };
      };
    };
  };

  return [
    ...(candidate.errors ?? []),
    ...(candidate.response?.data?.error?.errors ?? []),
  ]
    .map((entry) => normalizeReason(entry.reason))
    .filter((reason): reason is string => Boolean(reason));
}

function extractGoogleErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return redactSensitiveText(error);
  }

  if (typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      response?: {
        data?: {
          error?: {
            message?: unknown;
          };
        };
      };
      error?: {
        message?: unknown;
      };
    };

    for (const value of [
      candidate.message,
      candidate.response?.data?.error?.message,
      candidate.error?.message,
    ]) {
      if (typeof value === "string" && value.trim().length > 0) {
        return redactSensitiveText(value);
      }
    }
  }

  return "";
}

function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    cause?: {
      code?: unknown;
    };
  };

  return (
    isNetworkErrorCode(candidate.code) ||
    isNetworkErrorCode(candidate.cause?.code)
  );
}

function isNetworkErrorCode(value: unknown): boolean {
  return typeof value === "string" && networkErrorCodes.has(value.toUpperCase());
}

function normalizeReason(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
