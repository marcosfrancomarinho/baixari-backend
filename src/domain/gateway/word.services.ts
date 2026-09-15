import type { Readable } from 'node:stream';
import type { Path } from '../valuesobject/path.js';

export interface WordServices {
  generate(path: Path): Promise<Readable>;
  extract(path: Path, signal?: AbortSignal): AsyncGenerator<ExtractedPage>;
}

export interface ExtractedPage {
  file: string;
  page: number;
  totalPages: number;
  text: string;
}

export class WordGenerationError extends Error {}
