import type { Path } from '../../domain/valuesobject/path.js';
import type { ZipServices } from '../../domain/gateway/zip.services.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class ZipDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private zipServices: ZipServices) {}

  public async generate(path: Path): Promise<DownloadOutput> {
    return {
      stream: await this.zipServices.generate(path),
      extension: 'zip',
      contentType: 'application/zip',
    };
  }
}
