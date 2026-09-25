export class PdfConversionError extends Error {
  public constructor(public readonly status: number, message: string, public readonly retryAfter?: number) {
    super(message);
  }
}
