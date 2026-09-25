import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import type { FileDownloaderUseCase } from '../../app/usecase/file.downloader.usecase.js';
import { DocumentRequest, type DocumentKind } from '../../app/request/document.request.js';
import { sendHttpError } from '../http/http.error.response.js';
import type { DownloadOutput } from '../../app/strategy/download.output.strategy.js';

export class FileDownloaderController {
  public constructor(private readonly fileDownloaderUseCase: FileDownloaderUseCase) { }

  public async execute(httpRequest: Request, response: Response, kind: DocumentKind): Promise<void> {
    try {
      const documentRequest = DocumentRequest.forDownload({
        number: httpRequest.params.number,
        kind,
        format: httpRequest.query.format,
      });
      const output = await this.fileDownloaderUseCase.execute(documentRequest);

      const filename = `${kind}_${documentRequest.number}.${output.extension}`;
      this.setDownloadHeaders(response, output, filename);

      httpRequest.once('close', () => {
        if (!response.writableEnded) {
          output.stream.destroy(new Error('Cliente desconectado'));
        }
      });

      await pipeline(output.stream, response);
    } catch (error) {
      if (response.headersSent) {
        if (!response.writableEnded) {
          response.end();
        }
        return;
      }

      sendHttpError(response, error);
    }
  }

  private setDownloadHeaders(response: Response, output: DownloadOutput, filename: string): void {
    response.setHeader('Content-Type', output.contentType);
    response.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Transfer-Encoding', 'binary');
  }
}
