import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { sendPdfConversionHttpError } from '../http/http.error.response.js';
import type { PdfConversionUseCase } from '../../app/usecase/pdf.conversion.usecase.js';
import type { ConvertedPdf } from '../../app/model/document.upload.js';

export class PdfConversionController {
  public constructor(private readonly pdfConversionUseCase: PdfConversionUseCase) { }

  public async execute(request: Request, response: Response): Promise<void> {
    const cancellation = new AbortController();
    const cancel = () => cancellation.abort(new Error('Cliente desconectado.'));
    response.once('close', cancel);
    request.once('aborted', cancel);
    try {
      await this.pdfConversionUseCase.execute(
        { stream: request, headers: request.headers },
        (output, signal) => this.sendPdf(response, output, signal),
        cancellation.signal,
      );
    } catch (error) {
      if (!response.destroyed && !response.headersSent) {
        request.resume();
        sendPdfConversionHttpError(response, error);
      } else if (!response.destroyed) {
        response.destroy();
      }
    } finally {
      response.removeListener('close', cancel);
      request.removeListener('aborted', cancel);
    }
  }

  private async sendPdf(response: Response, output: ConvertedPdf, signal: AbortSignal): Promise<void> {
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', 'attachment; filename="documentos.pdf"');
    response.setHeader('Content-Length', output.size);
    response.setHeader('Cache-Control', 'no-store');
    await pipeline(output.stream, response, { signal });
  }
}
