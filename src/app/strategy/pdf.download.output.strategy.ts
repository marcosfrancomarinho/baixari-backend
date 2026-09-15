import type { FilesInput } from '../input/files.input.js';
import type { PdfServices } from '../contracts/pdf.services.js';
import type { DownloadOutput, DownloadOutputStrategy } from './download.output.strategy.js';

export class PdfDownloadOutputStrategy implements DownloadOutputStrategy {
  public constructor(private pdfServices: PdfServices) {}

  public async generate(input: FilesInput): Promise<DownloadOutput> {
    return {
      stream: await this.pdfServices.generate(input),
      extension: 'pdf',
      contentType: 'application/pdf',
    };
  }
}
