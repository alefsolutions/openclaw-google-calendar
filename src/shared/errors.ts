export class PluginConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PluginConfigurationError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

export class ExternalServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalServiceError";
  }
}

export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class AmbiguousCalendarEventReferenceError extends Error {
  readonly candidates: Array<{
    id: string;
    calendarId: string;
    summary: string;
    start?: string;
  }>;

  constructor(
    message: string,
    candidates: Array<{
      id: string;
      calendarId: string;
      summary: string;
      start?: string;
    }>,
  ) {
    super(message);
    this.name = "AmbiguousCalendarEventReferenceError";
    this.candidates = candidates;
  }
}

export class NotImplementedYetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedYetError";
  }
}
