import type { Path } from '../../domain/valuesobject/path.js';
import type { PdfServices } from '../../domain/gateway/pdf.services.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class PdfDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private pdfServices: PdfServices) {}

  public async generate(path: Path): Promise<DownloadOutput> {
    return {
      stream: await this.pdfServices.generate(path),
      extension: 'pdf',
      contentType: 'application/pdf',
    };
  }
}
