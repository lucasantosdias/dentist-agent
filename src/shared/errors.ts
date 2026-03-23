export class ApplicationError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, details);
  }
}
