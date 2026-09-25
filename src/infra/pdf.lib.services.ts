import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { PDFDocument } from 'pdf-lib';
import type { PdfServices } from '../app/contracts/pdf.services.js';
import type { DocumentFiles } from '../app/model/document.files.js';

export class PdfLibServices implements PdfServices {
  public async generate(documentFiles: DocumentFiles): Promise<Readable> {
    const { files } = documentFiles;
    if (files.length === 1 && extname(files[0]).toLowerCase() === '.pdf') {
      return Readable.from([await readFile(files[0])]);
    }

    const mergedDocument = await PDFDocument.create();
    for (const filePath of files) {
      const bytes = await readFile(filePath);
      const extension = extname(filePath).toLowerCase();
      if (extension === '.pdf') {
        await this.appendPdf(mergedDocument, bytes);
      } else {
        await this.appendImage(mergedDocument, bytes, extension);
      }
    }
    return Readable.from([Buffer.from(await mergedDocument.save())]);
  }

  private async appendPdf(destination: PDFDocument, bytes: Buffer): Promise<void> {
    const sourceDocument = await PDFDocument.load(bytes);
    const pages = await destination.copyPages(sourceDocument, sourceDocument.getPageIndices());
    for (const page of pages) {
      destination.addPage(page);
    }
  }

  private async appendImage(destination: PDFDocument, bytes: Buffer, extension: string): Promise<void> {
    const image = extension === '.png'
      ? await destination.embedPng(bytes)
      : await destination.embedJpg(new Uint8Array(bytes));
    const page = destination.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
}
