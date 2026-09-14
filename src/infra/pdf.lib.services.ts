import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { PDFDocument } from 'pdf-lib';
import type { PdfServices } from '../domain/gateway/pdf.services.js';
import type { Path } from '../domain/valuesobject/path.js';

export class PdfLibServices implements PdfServices {
  public async generate(path: Path): Promise<Readable> {
    const files = await this.findFiles(path.getPath());
    if (files.length === 0) throw new Error('Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.');
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

  private async findFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await this.findFiles(path));
      else if (entry.isFile() && ['.pdf', '.jpg', '.jpeg', '.png'].includes(extname(entry.name).toLowerCase())) files.push(path);
    }
    return files;
  }
}
