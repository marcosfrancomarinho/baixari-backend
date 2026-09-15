export class RequestValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'RequestValidationError';
  }
}
