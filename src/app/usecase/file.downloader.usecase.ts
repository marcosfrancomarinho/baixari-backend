import type { DownloadOutputStrategyFactory } from '../factory/download.output.strategy.factory.js';
import type { DownloadFormat, DocumentRequest } from '../request/document.request.js';
import type { DocumentFilesFinder } from '../services/document.files.finder.js';
import type { DownloadOutput } from '../strategy/download.output.strategy.js';

export class FileDownloaderUseCase {
  public constructor(
    private readonly documentFilesFinder: DocumentFilesFinder,
    private readonly outputStrategyFactory: DownloadOutputStrategyFactory,
  ) { }

  public async execute(request: DocumentRequest<DownloadFormat>): Promise<DownloadOutput> {
    const strategy = this.outputStrategyFactory.create(request.format);
    const documentFiles = await this.documentFilesFinder.find(request);

    return strategy.generate(documentFiles);
  }
}
