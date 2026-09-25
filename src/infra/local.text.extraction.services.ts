import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { PDFPageProxy } from 'pdfjs-dist';
import { createWorker, OEM, type Worker } from 'tesseract.js';
import type { DocumentFiles } from '../app/model/document.files.js';
import {
  TextExtractionError,
  type TextExtractionServices,
  type ExtractedPage,
} from '../app/contracts/text.extraction.services.js';

const MAX_OCR_PIXELS = 4_000_000;
const MAX_PDF_RENDER_SCALE = 2;
const PAGE_PAUSE_MS = 100;

// Resolve os recursos instalados mesmo no bundle CommonJS de producao.
const requireAsset = createRequire(resolve('package.json'));
type RecognizeText = (image: Buffer) => Promise<string>;

export class LocalTextExtractionServices implements TextExtractionServices {
  public async *extract(documentFiles: DocumentFiles, signal?: AbortSignal): AsyncGenerator<ExtractedPage> {
    signal?.throwIfAborted();
    const { directory, files } = documentFiles;
    let ocrWorker: Worker | undefined;

    // Cada extracao reutiliza seu proprio worker e so o cria quando precisa de OCR.
    const recognizeText: RecognizeText = async image => {
      signal?.throwIfAborted();
      ocrWorker ??= await this.createOcrWorker();
      const result = await ocrWorker.recognize(image);
      signal?.throwIfAborted();
      return result.data.text.trim();
    };

    try {
      for (const filePath of files) {
        signal?.throwIfAborted();
        if (extname(filePath).toLowerCase() === '.pdf') {
          yield* this.extractPdf(filePath, directory, recognizeText, signal);
          continue;
        }

        const text = await this.recognizeImage(filePath, recognizeText);
        yield { file: relative(directory, filePath), page: 1, totalPages: 1, text };
        await pause(PAGE_PAUSE_MS, undefined, { signal });
      }
    } catch (error) {
      signal?.throwIfAborted();
      throw new TextExtractionError(
        'Não foi possível extrair o texto. Verifique se os arquivos estão legíveis e os PDFs não exigem senha.',
        { cause: error },
      );
    } finally {
      await ocrWorker?.terminate();
    }
  }

  private createOcrWorker(): Promise<Worker> {
    const languageDirectory = dirname(requireAsset.resolve('@tesseract.js-data/por'));
    return createWorker('por', OEM.LSTM_ONLY, {
      langPath: join(languageDirectory, '4.0.0'),
      cacheMethod: 'none',
      errorHandler: () => { },
    });
  }

  private async *extractPdf(
    filePath: string,
    directory: string,
    recognizeText: RecognizeText,
    signal?: AbortSignal,
  ): AsyncGenerator<ExtractedPage> {
    const { getDocument, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdfAssetsDirectory = dirname(requireAsset.resolve('pdfjs-dist/package.json'));
    const imageOperators = [OPS.paintImageXObject, OPS.paintInlineImageXObject];
    const loadingTask = getDocument({
      url: pathToFileURL(filePath).href,
      disableAutoFetch: true,
      disableStream: true,
      standardFontDataUrl: join(pdfAssetsDirectory, 'standard_fonts') + '/',
      cMapUrl: join(pdfAssetsDirectory, 'cmaps') + '/',
      cMapPacked: true,
      useSystemFonts: true,
    });

    try {
      const document = await loadingTask.promise;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        signal?.throwIfAborted();
        const page = await document.getPage(pageNumber);
        let text: string;
        try {
          text = await this.extractPageText(page, imageOperators, recognizeText);
        } finally {
          page.cleanup();
        }

        signal?.throwIfAborted();
        yield {
          file: relative(directory, filePath),
          page: pageNumber,
          totalPages: document.numPages,
          text,
        };
        await pause(PAGE_PAUSE_MS, undefined, { signal });
      }
    } finally {
      await loadingTask.destroy();
    }
  }

  private async extractPageText(
    page: PDFPageProxy,
    imageOperators: readonly number[],
    recognizeText: RecognizeText,
  ): Promise<string> {
    const content = await page.getTextContent();
    const nativeText = content.items
      .map(item => {
        if (!('str' in item)) return '';
        return item.str + (item.hasEOL ? '\n' : ' ');
      })
      .join('')
      .trim();

    // Paginas mistas tambem precisam de OCR para incluir o texto contido nas imagens.
    const operations = await page.getOperatorList();
    const hasImages = operations.fnArray.some(operator => imageOperators.includes(operator));
    if (nativeText && !hasImages) {
      return nativeText;
    }

    const recognizedText = await this.recognizePdfPage(page, recognizeText);
    return recognizedText || nativeText;
  }

  private async recognizePdfPage(page: PDFPageProxy, recognizeText: RecognizeText): Promise<string> {
    const originalViewport = page.getViewport({ scale: 1 });
    const pixelCount = originalViewport.width * originalViewport.height;
    const scale = Math.min(MAX_PDF_RENDER_SCALE, Math.sqrt(MAX_OCR_PIXELS / pixelCount));
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

    try {
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      return await recognizeText(canvas.toBuffer('image/png'));
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  private async recognizeImage(filePath: string, recognizeText: RecognizeText): Promise<string> {
    const image = await loadImage(await readFile(filePath));
    const scale = Math.min(1, Math.sqrt(MAX_OCR_PIXELS / (image.width * image.height)));
    const width = Math.max(1, Math.floor(image.width * scale));
    const height = Math.max(1, Math.floor(image.height * scale));
    const canvas = createCanvas(width, height);

    try {
      const context = canvas.getContext('2d');
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return await recognizeText(canvas.toBuffer('image/png'));
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
