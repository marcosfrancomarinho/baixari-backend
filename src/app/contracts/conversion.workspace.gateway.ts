import type { ConvertedPdf } from '../model/document.upload.js';

export interface ConversionWorkspaceGateway {
  create(): Promise<string>;
  checkSpace(directory: string): Promise<void>;
  watch(directory: string, onError: (error: unknown) => void): () => void;
  openOutput(path: string): Promise<ConvertedPdf>;
  remove(directory: string): Promise<void>;
}
