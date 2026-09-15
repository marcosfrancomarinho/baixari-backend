import type { ZipServices } from '../contracts/zip.services.js';
import type { DocumentFiles } from '../model/document.files.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class ZipDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private zipServices: ZipServices) {}

  public async generate(documentFiles: DocumentFiles): Promise<DownloadOutput> {
    return {
      stream: await this.zipServices.generate(documentFiles),
      extension: 'zip',
      contentType: 'application/zip',
    };
  }
}
