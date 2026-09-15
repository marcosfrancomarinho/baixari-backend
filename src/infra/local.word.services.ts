import { readFile, readdir } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { WordGenerationError, type WordServices, type ExtractedPage } from '../domain/gateway/word.services.js';
import type { Path } from '../domain/valuesobject/path.js';

// Resolve installed assets also when the application is bundled as CommonJS.
const requireAsset = createRequire(resolve('package.json'));

export class LocalWordServices implements WordServices {
  public async generate(path: Path): Promise<Readable> {
    const paragraphs: Paragraph[] = [];
    let previousFile: string | undefined;
    for await (const page of this.extract(path)) {
      if (page.file !== previousFile) {
        paragraphs.push(new Paragraph({ text: page.file, heading: HeadingLevel.HEADING_1, pageBreakBefore: paragraphs.length > 0 }));
        previousFile = page.file;
      }
      paragraphs.push(new Paragraph({ text: `Página ${page.page}`, heading: HeadingLevel.HEADING_2 }));
      for (const line of (page.text || '[Nenhum texto reconhecido nesta página.]').split(/\r?\n/)) {
        paragraphs.push(new Paragraph({ text: line }));
      }
    }
    const document = new Document({
      styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
      sections: [{ children: paragraphs }],
    });
    return Readable.from([await Packer.toBuffer(document)]);
  }

  public async *extract(path: Path, signal?: AbortSignal): AsyncGenerator<ExtractedPage> {
    signal?.throwIfAborted();
    const root = path.getPath();
    const files = await this.findFiles(root);
    if (!files.length) throw new Error('Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.');
    let worker: Worker | undefined;
    const recognize = async (image: Buffer): Promise<string> => {
      signal?.throwIfAborted();
      worker ??= await createWorker('por', OEM.LSTM_ONLY, {
        langPath: join(dirname(requireAsset.resolve('@tesseract.js-data/por')), '4.0.0'),
        cacheMethod: 'none',
        errorHandler: () => {},
      });
      const text = (await worker.recognize(image)).data.text.trim();
      signal?.throwIfAborted();
      return text;
    };
    try {
      for (const file of files) {
        signal?.throwIfAborted();
        if (extname(file).toLowerCase() !== '.pdf') {
          const text = await this.recognizeImage(file, recognize);
          yield { file: relative(root, file), page: 1, totalPages: 1, text };
          await pause(100, undefined, { signal });
          continue;
        }
        const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const pdfRoot = dirname(requireAsset.resolve('pdfjs-dist/package.json'));
        const loading = getDocument({
          url: pathToFileURL(file).href,
          disableAutoFetch: true,
          disableStream: true,
          standardFontDataUrl: join(pdfRoot, 'standard_fonts') + '/',
          cMapUrl: join(pdfRoot, 'cmaps') + '/',
          cMapPacked: true,
          useSystemFonts: true,
        });
        try {
          const pdf = await loading.promise;
          for (let number = 1; number <= pdf.numPages; number++) {
            signal?.throwIfAborted();
            const page = await pdf.getPage(number);
            let text = '';
            try {
              const content = await page.getTextContent();
              text = content.items.map(item => 'str' in item
                ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim();
              // Render mixed pages too, so text inside images is not silently lost.
              const operations = await page.getOperatorList();
              const hasImages = operations.fnArray.some(op =>
                op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject);
              if (!text || hasImages) {
                const base = page.getViewport({ scale: 1 });
                const scale = Math.min(2, Math.sqrt(4_000_000 / (base.width * base.height)));
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
            } finally {
              page.cleanup();
            }
            signal?.throwIfAborted();
            yield { file: relative(root, file), page: number, totalPages: pdf.numPages, text };
            await pause(100, undefined, { signal });
          }
        } finally {
          await loading.destroy();
        }
      }
    } catch (error) {
      signal?.throwIfAborted();
      throw new WordGenerationError('Não foi possível extrair o texto e gerar o Word. Verifique se os arquivos estão legíveis e os PDFs não exigem senha.', { cause: error });
    } finally {
      await worker?.terminate();
    }
  }

  private async recognizeImage(file: string, recognize: (image: Buffer) => Promise<string>): Promise<string> {
    const image = await loadImage(await readFile(file));
    const scale = Math.min(1, Math.sqrt(4_000_000 / (image.width * image.height)));
    const canvas = createCanvas(Math.max(1, Math.floor(image.width * scale)), Math.max(1, Math.floor(image.height * scale)));
    try {
      const context = canvas.getContext('2d');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await recognize(canvas.toBuffer('image/png'));
    } finally {
      canvas.width = 0;
      canvas.height = 0;
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
