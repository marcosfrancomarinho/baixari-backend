import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { DocumentUpload } from '../app/model/document.upload.js';
import type { DocumentUploadGateway, UploadProgressHandler } from '../app/contracts/document.upload.gateway.js';
import { PdfConversionError } from '../app/errors/pdf.conversion.error.js';
import type { ConversionConfig } from './pdf.conversion.config.js';

const MAX_PENDING_FILE_WRITES = 8;

export class DiskDocumentUpload implements DocumentUploadGateway {
  public constructor(private readonly config: ConversionConfig) { }

  public async receive(
    input: DocumentUpload,
    directory: string,
    signal: AbortSignal,
    onProgress: UploadProgressHandler,
  ): Promise<number> {
    const { stream: uploadStream, headers } = input;
    const parser = this.createMultipartParser(headers);
    const uploadCancellation = new AbortController();
    const cancelUpload = () => uploadCancellation.abort(signal.reason);
    signal.addEventListener('abort', cancelUpload, { once: true });
    if (signal.aborted) cancelUpload();

    let documentCount = 0;
    let failure: unknown;
    const pendingWrites = new Set<Promise<void>>();
    const failUpload = (error: unknown) => {
      failure ??= error;
      // Aguarda o Busboy terminar o chunk atual antes de destruir seus streams.
      queueMicrotask(() => uploadCancellation.abort(failure));
    };
    const { stream: uploadMonitor, stopIdleTimer } = this.createUploadMonitor(pendingWrites, failUpload, onProgress);

    parser.on('file', (field, stream) => {
      stream.on('error', failUpload);
      if (field !== 'files') {
        stream.resume();
        failUpload(new PdfConversionError(400, 'Use somente o campo files para os documentos.'));
        return;
      }
      const uploadPath = join(directory, `${documentCount}.upload`);
      documentCount++;
      stream.once('limit', () => failUpload(new PdfConversionError(413, 'Arquivo excede PDF_MAX_FILE_BYTES.')));
      const destination = createWriteStream(uploadPath, { flags: 'wx', mode: 0o600 });
      const writeTask = pipeline(stream, destination, { signal: uploadCancellation.signal })
        .catch(failUpload)
        .finally(() => pendingWrites.delete(writeTask));
      pendingWrites.add(writeTask);
    });
    parser.once('fieldsLimit', () => failUpload(new PdfConversionError(400, 'Use somente arquivos no campo files.')));
    const handleRequestError = () => failUpload(new PdfConversionError(400, 'Upload interrompido.'));
    uploadStream.once('aborted', handleRequestError);
    uploadStream.once('error', handleRequestError);

    try {
      const uploadCompletion = pipeline(uploadMonitor, parser, { signal: uploadCancellation.signal });
      uploadStream.pipe(uploadMonitor);
      await uploadCompletion;
      await Promise.all(pendingWrites);
      if (failure) {
        throw failure;
      }
      return documentCount;
    } catch (error) {
      const reason = failure ?? (signal.aborted ? signal.reason : error);
      const isInfrastructureError = Boolean((reason as NodeJS.ErrnoException)?.code);
      if (reason instanceof PdfConversionError || signal.aborted || isInfrastructureError) {
        throw reason;
      }
      throw new PdfConversionError(400, 'Upload multipart incompleto ou invalido.');
    } finally {
      stopIdleTimer();
      uploadStream.unpipe(uploadMonitor);
      uploadCancellation.abort();
      await Promise.all(pendingWrites);
      signal.removeEventListener('abort', cancelUpload);
      uploadStream.removeListener('aborted', handleRequestError);
      uploadStream.removeListener('error', handleRequestError);
    }
  }

  private createMultipartParser(headers: DocumentUpload['headers']): ReturnType<typeof Busboy> {
    try {
      return Busboy({
        headers,
        limits: { fileSize: this.config.maxFileBytes, fields: 0 },
      });
    } catch {
      throw new PdfConversionError(400, 'Envie multipart/form-data com arquivos no campo files.');
    }
  }

  private createUploadMonitor(
    pendingWrites: Set<Promise<void>>,
    onFailure: (error: unknown) => void,
    onProgress: UploadProgressHandler,
  ): { stream: Transform; stopIdleTimer: () => void; } {
    const onIdle = () => onFailure(new PdfConversionError(408, 'Upload interrompido por inatividade.'));
    let idleTimer = setTimeout(onIdle, this.config.uploadIdleMs);
    let receivedBytes = 0;

    const beforeForwardingChunk = async (chunk: Buffer): Promise<void> => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(onIdle, this.config.uploadIdleMs);
      receivedBytes += chunk.length;

      // Limita tambem os fechamentos pendentes quando chegam muitos arquivos pequenos.
      if (pendingWrites.size >= MAX_PENDING_FILE_WRITES) {
        await Promise.race(pendingWrites);
      }

      await onProgress(receivedBytes);
    };

    const stream = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        beforeForwardingChunk(chunk).then(() => callback(null, chunk), callback);
      },
    });

    return { stream, stopIdleTimer: () => clearTimeout(idleTimer) };
  }
}
