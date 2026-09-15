import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { createCanvas } from '@napi-rs/canvas';
import { WordGenerationError, type WordServices } from '../domain/gateway/word.services.js';
import type { Path } from '../domain/valuesobject/path.js';

// Resolve installed assets also when the application is bundled as CommonJS.
const requireAsset = createRequire(resolve('package.json'));

export class LocalWordServices implements WordServices {
  public async generate(path: Path): Promise<Readable> {
    const root = path.getPath();
    const files = await this.findFiles(root);
    if (!files.length) throw new Error('Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.');
    let worker: Worker | undefined;
    const recognize = async (image: Buffer): Promise<string> => {
      worker ??= await createWorker('por', OEM.LSTM_ONLY, {
        langPath: join(dirname(requireAsset.resolve('@tesseract.js-data/por')), '4.0.0'),
        cacheMethod: 'none',
        errorHandler: () => {},
      });
      return (await worker.recognize(image)).data.text.trim();
    };
    const paragraphs: Paragraph[] = [];
    const addPage = (text: string, page: number) => {
      paragraphs.push(new Paragraph({ text: `Página ${page}`, heading: HeadingLevel.HEADING_2 }));
      for (const line of (text || '[Nenhum texto reconhecido nesta página.]').split(/\r?\n/)) {
        paragraphs.push(new Paragraph({ text: line }));
      }
    };
    try {
      for (const file of files) {
        paragraphs.push(new Paragraph({
          text: relative(root, file), heading: HeadingLevel.HEADING_1,
          pageBreakBefore: paragraphs.length > 0,
        }));
        const bytes = await readFile(file);
        if (extname(file).toLowerCase() !== '.pdf') {
          addPage(await recognize(bytes), 1);
          continue;
        }
        const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdfRoot = dirname(requireAsset.resolve('pdfjs-dist/package.json'));
        const loading = getDocument({
          data: new Uint8Array(bytes),
          standardFontDataUrl: join(pdfRoot, 'standard_fonts') + '/',
          cMapUrl: join(pdfRoot, 'cmaps') + '/',
          cMapPacked: true,
          useSystemFonts: true,
        });
        try {
          const pdf = await loading.promise;
          for (let number = 1; number <= pdf.numPages; number++) {
            const page = await pdf.getPage(number);
            try {
              const content = await page.getTextContent();
              let text = content.items.map(item => 'str' in item
                ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
              // Render mixed pages too, so text inside images is not silently lost.
              const operations = await page.getOperatorList();
              const hasImages = operations.fnArray.some(op =>
                op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject);
              if (!text || hasImages) {
                const base = page.getViewport({ scale: 1 });
                const scale = Math.min(3, Math.sqrt(16_000_000 / (base.width * base.height)));
                const viewport = page.getViewport({ scale });
                const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
                try {
                  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
                  text = await recognize(canvas.toBuffer('image/png')) || text;
                } finally {
                  canvas.width = 0;
                  canvas.height = 0;
                }
              }
              addPage(text, number);
            } finally {
              page.cleanup();
            }
          }
        } finally {
          await loading.destroy();
        }
      }
      const document = new Document({
        styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
        sections: [{ children: paragraphs }],
      });
      return Readable.from([await Packer.toBuffer(document)]);
    } catch (error) {
      throw new WordGenerationError('Não foi possível extrair o texto e gerar o Word. Verifique se os arquivos estão legíveis e os PDFs não exigem senha.', { cause: error });
    } finally {
      await worker?.terminate();
    }
  }

  private async findFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const files: string[] = [];
    for (const entry of entries) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...await this.findFiles(file));
      else if (entry.isFile() && ['.pdf', '.png', '.jpg', '.jpeg'].includes(extname(entry.name).toLowerCase())) files.push(file);
    }
    return files;
  }
}
