import type { Readable } from 'node:stream';
import type { DocumentFiles } from '../model/document.files.js';
import type { DownloadFormat } from '../request/document.request.js';

export interface DownloadOutput {
  stream: Readable;
  extension: DownloadFormat;
  contentType: string;
}

export interface DownloadOutputStrategy {
  generate(documentFiles: DocumentFiles): Promise<DownloadOutput>;
}
