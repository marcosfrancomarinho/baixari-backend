import type { Readable } from 'node:stream';
import type { Path } from '../valuesobject/path.js';

export interface WordServices {
  generate(path: Path): Promise<Readable>;
}

export class WordGenerationError extends Error {}
