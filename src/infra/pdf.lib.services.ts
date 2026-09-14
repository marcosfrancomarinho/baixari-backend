import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { PDFDocument } from 'pdf-lib';
import type { PdfServices } from '../domain/gateway/pdf.services.js';
import type { Path } from '../domain/valuesobject/path.js';

export class PdfLibServices implements PdfServices {
  public async generate(path: Path): Promise<Readable> {
    const files = await this.findPdfs(path.getPath());
    if (files.length === 0) throw new Error('Nenhum PDF encontrado na pasta.');
    if (files.length === 1) return Readable.from([await readFile(files[0])]);

    const merged = await PDFDocument.create();
    for (const file of files) {
      const source = await PDFDocument.load(await readFile(file));
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }
    return Readable.from([Buffer.from(await merged.save())]);
  }

  private async findPdfs(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const files: string[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await this.findPdfs(path));
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.pdf') files.push(path);
    }
    return files;
  }
}
