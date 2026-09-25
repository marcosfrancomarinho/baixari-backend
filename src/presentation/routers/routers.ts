import type { Express } from 'express';
import type { FileDownloaderController } from '../controllers/file.downloader.controller.js';
import type { TextExtractionController } from '../controllers/text.extraction.controller.js';

export class Routers {
  public constructor(
    private readonly fileDownloaderController: FileDownloaderController,
    private readonly textExtractionController: TextExtractionController,
  ) { }

  public setup(app: Express): void {
    app.get('/protocol/:number/text', (request, response) =>
      this.textExtractionController.execute(request, response, 'protocol'),
    );
    app.get('/certificate/:number/text', (request, response) =>
      this.textExtractionController.execute(request, response, 'certificate'),
    );
    app.get('/protocol/:number', (request, response) =>
      this.fileDownloaderController.execute(request, response, 'protocol'),
    );
    app.get('/certificate/:number', (request, response) =>
      this.fileDownloaderController.execute(request, response, 'certificate'),
    );
  }
}
