import type { FilesInput } from '../app/input/files.input.js';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { PDFDocument } from 'pdf-lib';
import type { PdfServices } from '../app/contracts/pdf.services.js';

export class PdfLibServices implements PdfServices {
  public async generate(input: FilesInput): Promise<Readable> {
    const files = input.files;
    if (files.length === 1 && extname(files[0]).toLowerCase() === '.pdf') {
      return Readable.from([await readFile(files[0])]);
    }

    const merged = await PDFDocument.create();
    for (const file of files) {
      const bytes = await readFile(file);
      const extension = extname(file).toLowerCase();
      if (extension === '.pdf') {
        const source = await PDFDocument.load(bytes);
        const pages = await merged.copyPages(source, source.getPageIndices());
        for (const page of pages) merged.addPage(page);
      } else {
        const image = extension === '.png'
          ? await merged.embedPng(bytes)
          : await merged.embedJpg(new Uint8Array(bytes));
        const page = merged.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
    }
    return Readable.from([Buffer.from(await merged.save())]);
  }
}
