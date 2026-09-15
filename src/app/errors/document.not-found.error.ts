export class DocumentNotFoundError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DocumentNotFoundError';
  }
}
