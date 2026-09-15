import type { FilesInput } from '../input/files.input.js';
import type { Readable } from 'node:stream';

export interface PdfServices {
  generate(input: FilesInput): Promise<Readable>;
}
