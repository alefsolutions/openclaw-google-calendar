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

export class ResourceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class NotImplementedYetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedYetError";
  }
}
