import type { FilesInput } from '../input/files.input.js';
import type { ZipServices } from '../contracts/zip.services.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class ZipDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private zipServices: ZipServices) {}

  public async generate(input: FilesInput): Promise<DownloadOutput> {
    return {
      stream: await this.zipServices.generate(input),
      extension: 'zip',
      contentType: 'application/zip',
    };
  }
}
