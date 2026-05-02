import type { CertificateFileDownloaderUseCase } from '../../app/usecase/certificate.file.downloader.usecase.js';
import type { Request, Response } from 'express';
import { pipeline } from 'stream/promises';

export class CertificateFileDownloaderController {
  public constructor(private  certificateFileDownloaderUseCase: CertificateFileDownloaderUseCase) {}

  public async execute(request: Request, response: Response): Promise<void> {
    try {
      const number = Number.parseInt(request.params.number as string);
      const output = await this.certificateFileDownloaderUseCase.dowload({ number });
      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename=certificate_${number}.zip`);

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
        response.status(404).json({
          error: (error as Error).message,
        });
      }
    }
  }
}
