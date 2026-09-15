import { InvalidInputError } from '../../app/input/invalid.input.error.js';
import { DocumentInput } from '../../app/input/document.input.js';
import type { CertificateFileDownloaderUseCase } from '../../app/usecase/certificate.file.downloader.usecase.js';
import type { Request, Response } from 'express';
import { pipeline } from 'stream/promises';
import { InvalidDownloadFormatError, parseDownloadFormat } from '../../app/dto/download.format.js';

export class CertificateFileDownloaderController {
  public constructor(private certificateFileDownloaderUseCase: CertificateFileDownloaderUseCase) {}

  public async execute(request: Request, response: Response): Promise<void> {
    try {
      const number = DocumentInput.fromRoute(request.params.number, 'certificate').number;
      const format = parseDownloadFormat(request.query.format);
      const output = await this.certificateFileDownloaderUseCase.dowload({ number, format });
      response.setHeader('Content-Type', output.contentType);
      response.setHeader('Content-Disposition', `attachment; filename=certificate_${number}.${output.extension}`);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Transfer-Encoding', 'binary');
      
      request.on('close', () => {
        if (!response.writableEnded) {
          output.stream.destroy(new Error('Cliente desconectado'));
        }
      });

      output.stream.on('error', (err) => {
        console.error('Stream error:', err.message);

        if (!response.headersSent) {
          response.status(500).end('Erro ao baixar o arquivo');
        } else {
          response.end();
        }
      });

      await pipeline(output.stream, response);
    } catch (error) {
      if (!response.headersSent) {
        response.status(error instanceof InvalidDownloadFormatError || error instanceof InvalidInputError ? 400 : 404).json({
          error: (error as Error).message,
        });
      }
    }
  }
}
