import type { FilesInput } from '../input/files.input.js';
import type { Readable } from 'node:stream';
import type { DownloadFormat } from '../dto/download.format.js';

export interface DownloadOutput {
  stream: Readable;
  extension: DownloadFormat;
  contentType: string;
}

export interface DownloadOutputStrategy {
  generate(input: FilesInput): Promise<DownloadOutput>;
}
