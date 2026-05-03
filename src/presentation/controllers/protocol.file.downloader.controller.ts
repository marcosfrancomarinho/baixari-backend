import type { ProtocolFileDownloaderUseCase } from '../../app/usecase/protocol.file.downloader.usecase.js';
import type { Request, Response } from 'express';
import { pipeline } from 'stream/promises';

export class ProtocolFileDownloaderController {
  public constructor(private protocolFileDownloaderUseCase: ProtocolFileDownloaderUseCase) {}

  public async execute(request: Request, response: Response): Promise<void> {
    try {
      const number = Number.parseInt(request.params.number as string);
      const output = await this.protocolFileDownloaderUseCase.dowload({ number });

      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename=protocol_${number}.zip`);
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
        response.status(404).json({
          error: (error as Error).message,
        });
      }
    }
  }
}
