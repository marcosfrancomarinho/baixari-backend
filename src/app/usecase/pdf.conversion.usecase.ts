import type { ConversionWorkspaceGateway } from '../contracts/conversion.workspace.gateway.js';
import type { DocumentUploadGateway, UploadProgressHandler } from '../contracts/document.upload.gateway.js';
import type { PdfConversionGateway } from '../contracts/pdf.conversion.gateway.js';
import { PdfConversionError } from '../errors/pdf.conversion.error.js';
import type { ConvertedPdf, DocumentUpload } from '../model/document.upload.js';
import { PdfConversionRequest } from '../request/pdf.conversion.request.js';

const UPLOAD_DISK_CHECK_INTERVAL_BYTES = 8 * 1024 * 1024;

export class PdfConversionUseCase {
  private activeConversions = 0;

  public constructor(
    private readonly upload: DocumentUploadGateway,
    private readonly converter: PdfConversionGateway,
    private readonly workspace: ConversionWorkspaceGateway,
    private readonly maxConcurrentConversions: number,
  ) { }

  // A vaga e os temporarios permanecem reservados ate o download terminar.
  public async execute(
    input: DocumentUpload,
    deliverPdf: (output: ConvertedPdf, signal: AbortSignal) => Promise<void>,
    signal: AbortSignal,
  ): Promise<void> {
    signal.throwIfAborted();
    const request = PdfConversionRequest.from(input);
    this.reserveConversionSlot();

    const cancellation = new AbortController();
    const forwardCancellation = () => cancellation.abort(signal.reason);
    signal.addEventListener('abort', forwardCancellation, { once: true });

    let workingDirectory: string | undefined;
    let stopDiskMonitoring: (() => void) | undefined;
    let output: ConvertedPdf | undefined;
    try {
      await this.converter.check(cancellation.signal);
      workingDirectory = await this.workspace.create();
      cancellation.signal.throwIfAborted();
      stopDiskMonitoring = this.workspace.watch(workingDirectory, error => cancellation.abort(error));

      const documentCount = await this.upload.receive(
        request.upload,
        workingDirectory,
        cancellation.signal,
        this.createUploadProgressHandler(workingDirectory),
      );
      if (documentCount === 0) {
        throw new PdfConversionError(400, 'Envie pelo menos um documento.');
      }

      const outputPath = await this.converter.convert(workingDirectory, documentCount, cancellation.signal);
      output = await this.workspace.openOutput(outputPath);
      if (output.size === 0) {
        throw new PdfConversionError(422, 'Os documentos nao produziram um PDF valido.');
      }

      await deliverPdf(output, cancellation.signal);
    } finally {
      stopDiskMonitoring?.();
      signal.removeEventListener('abort', forwardCancellation);
      output?.stream.destroy();
      try {
        if (workingDirectory) await this.workspace.remove(workingDirectory);
      } finally {
        this.activeConversions--;
      }
    }
  }

  private createUploadProgressHandler(directory: string): UploadProgressHandler {
    let bytesAtLastDiskCheck = 0;

    return async receivedBytes => {
      if (receivedBytes - bytesAtLastDiskCheck < UPLOAD_DISK_CHECK_INTERVAL_BYTES) {
        return;
      }

      await this.workspace.checkSpace(directory);
      bytesAtLastDiskCheck = receivedBytes;
    };
  }

  private reserveConversionSlot(): void {
    if (this.activeConversions >= this.maxConcurrentConversions) {
      throw new PdfConversionError(503, 'Conversor ocupado. Tente novamente em instantes.', 10);
    }

    this.activeConversions++;
  }
}
