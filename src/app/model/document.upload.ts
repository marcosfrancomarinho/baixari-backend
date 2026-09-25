import type { Readable } from 'node:stream';

export interface DocumentUpload {
  stream: Readable;
  headers: Record<string, string | string[] | undefined>;
}

export interface ConvertedPdf {
  stream: Readable;
  size: number;
}
