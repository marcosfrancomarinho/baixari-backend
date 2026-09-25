export interface PdfConversionGateway {
  check(signal: AbortSignal): Promise<void>;
  convert(directory: string, count: number, signal: AbortSignal): Promise<string>;
}
