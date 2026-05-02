import type { CertificateFileDownloaderController } from '../controllers/certificate.file.downloader.controller.js';
import type { ProtocolFileDownloaderController } from '../controllers/protocol.file.downloader.controller.js';
import type { Express } from 'express';
export class Routers {
  public constructor(
    private protocolFileDownloaderController: ProtocolFileDownloaderController,
    private certificateFileDownloaderController: CertificateFileDownloaderController,
  ) {}

  public setup(app: Express) {
    app.get('/protocol/:number', (request, response) => this.protocolFileDownloaderController.execute(request, response));
    app.get('/certificate/:number', (request, response) => this.certificateFileDownloaderController.execute(request, response));
  }
}
