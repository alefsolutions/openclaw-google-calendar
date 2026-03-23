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

export class NotImplementedYetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotImplementedYetError";
  }
}
