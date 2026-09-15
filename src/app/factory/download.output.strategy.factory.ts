import { parseDownloadFormat, type DownloadFormat } from '../dto/download.format.js';
import type { DownloadOutputStrategy } from '../strategy/download.output.strategy.js';
import type { PdfDownloadOutputStrategy } from '../strategy/pdf.download.output.strategy.js';
import type { ZipDownloadOutputStrategy } from '../strategy/zip.download.output.strategy.js';
import type { WordDownloadOutputStrategy } from '../strategy/word.download.output.strategy.js';

export class DownloadOutputStrategyFactory {
  private readonly strategies: Record<DownloadFormat, DownloadOutputStrategy>;

  public constructor(
    zipStrategy: ZipDownloadOutputStrategy,
    pdfStrategy: PdfDownloadOutputStrategy,
    wordStrategy: WordDownloadOutputStrategy,
  ) {
    this.strategies = { zip: zipStrategy, pdf: pdfStrategy, docx: wordStrategy };
  }

  public create(format?: DownloadFormat): DownloadOutputStrategy {
    return this.strategies[parseDownloadFormat(format)];
  }
}
