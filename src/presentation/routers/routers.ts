import type { CertificateFileDownloaderController } from '../controllers/certificate.file.downloader.controller.js';
import type { ProtocolFileDownloaderController } from '../controllers/protocol.file.downloader.controller.js';
import type { Express } from 'express';
import type { TextExtractionController } from '../controllers/text.extraction.controller.js';

export class Routers {
  public constructor(
    private protocolFileDownloaderController: ProtocolFileDownloaderController,
    private certificateFileDownloaderController: CertificateFileDownloaderController,
    private textExtractionController: TextExtractionController,
  ) {}

  public setup(app: Express) {
    app.get('/protocol/:number/text', (request, response) =>
      this.textExtractionController.execute(request, response, 'protocol'),
    );
    app.get('/certificate/:number/text', (request, response) =>
      this.textExtractionController.execute(request, response, 'certificate'),
    );
    app.get('/protocol/:number', (request, response) => this.protocolFileDownloaderController.execute(request, response));
    app.get('/certificate/:number', (request, response) => this.certificateFileDownloaderController.execute(request, response));
  }
}
