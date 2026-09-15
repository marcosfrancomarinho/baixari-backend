import type { FilesInput } from '../input/files.input.js';
export interface TextExtractionServices {
  extract(input: FilesInput, signal?: AbortSignal): AsyncGenerator<ExtractedPage>;
}

export interface ExtractedPage {
  file: string;
  page: number;
  totalPages: number;
  text: string;
}

export class TextExtractionError extends Error {}
