import type { DocumentFiles } from '../model/document.files.js';

export interface TextExtractionServices {
  extract(documentFiles: DocumentFiles, signal?: AbortSignal): AsyncGenerator<ExtractedPage>;
}

export interface ExtractedPage {
  file: string;
  page: number;
  totalPages: number;
  text: string;
}

export class TextExtractionError extends Error {}
