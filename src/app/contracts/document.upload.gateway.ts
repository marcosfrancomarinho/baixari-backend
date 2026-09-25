import type { DocumentUpload } from '../model/document.upload.js';

export type UploadProgressHandler = (receivedBytes: number) => Promise<void>;

export interface DocumentUploadGateway {
  receive(
    input: DocumentUpload,
    directory: string,
    signal: AbortSignal,
    onProgress: UploadProgressHandler,
  ): Promise<number>;
}
