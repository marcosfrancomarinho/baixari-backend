export type DownloadFormat = 'zip' | 'pdf' | 'docx';

export class InvalidDownloadFormatError extends Error {}

export function parseDownloadFormat(value: unknown): DownloadFormat {
  if (value === undefined) return 'zip';
  if (value === 'zip' || value === 'pdf' || value === 'docx') return value;
  throw new InvalidDownloadFormatError('Formato invalido. Use zip, pdf ou docx.');
}
