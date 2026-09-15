export type DownloadFormat = 'zip' | 'pdf';

export class InvalidDownloadFormatError extends Error {}

export function parseDownloadFormat(value: unknown): DownloadFormat {
  if (value === undefined) return 'zip';
  if (value === 'zip' || value === 'pdf') return value;
  throw new InvalidDownloadFormatError('Formato invalido. Use zip ou pdf.');
}
