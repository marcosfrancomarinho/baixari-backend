import type { Readable } from 'node:stream';
import type { DocumentFiles } from '../model/document.files.js';

export interface PdfServices {
  generate(documentFiles: DocumentFiles): Promise<Readable>;
}
