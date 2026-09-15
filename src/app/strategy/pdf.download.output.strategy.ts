import type { PdfServices } from '../contracts/pdf.services.js';
import type { DocumentFiles } from '../model/document.files.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class PdfDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private pdfServices: PdfServices) {}

  public async generate(documentFiles: DocumentFiles): Promise<DownloadOutput> {
    return {
      stream: await this.pdfServices.generate(documentFiles),
      extension: 'pdf',
      contentType: 'application/pdf',
    };
  }
}
