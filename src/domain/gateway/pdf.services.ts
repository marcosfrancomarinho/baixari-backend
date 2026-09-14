import type { Readable } from 'node:stream';
import type { Path } from '../valuesobject/path.js';

export interface PdfServices {
  generate(path: Path): Promise<Readable>;
}
