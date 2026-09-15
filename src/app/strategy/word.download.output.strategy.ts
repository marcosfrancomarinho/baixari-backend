import type { Path } from '../../domain/valuesobject/path.js';
import type { WordServices } from '../../domain/gateway/word.services.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class WordDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private wordServices: WordServices) {}

  public async generate(path: Path): Promise<DownloadOutput> {
    return {
      stream: await this.wordServices.generate(path),
      extension: 'docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
}
