import type { Request, Response } from 'express';
import { once } from 'node:events';
import { type TextExtractionUseCase } from '../../app/usecase/text.extraction.usecase.js';
import { DocumentRequest, type DocumentKind } from '../../app/request/document.request.js';
import { sendHttpError } from '../http/http.error.response.js';

export class TextExtractionController {
  public constructor(private readonly textExtractionUseCase: TextExtractionUseCase) { }

  public async execute(httpRequest: Request, response: Response, kind: DocumentKind): Promise<void> {
    const cancellation = new AbortController();
    const onClose = () => cancellation.abort();
    response.once('close', onClose);
    try {
      const documentRequest = DocumentRequest.forText({
        number: httpRequest.params.number,
        kind,
      });
      const extraction = await this.textExtractionUseCase.execute(documentRequest, cancellation.signal);
      cancellation.signal.throwIfAborted();
      this.startStreamingResponse(response);
      await this.sendEvent(response, { type: 'start' }, cancellation.signal);
      let extractedPageCount = 0;
      for await (const page of extraction) {
        await this.sendEvent(response, { type: 'page', ...page }, cancellation.signal);
        extractedPageCount++;
      }
      await this.sendEvent(response, { type: 'done', pages: extractedPageCount }, cancellation.signal);
      response.end();
    } catch (error) {
      if (cancellation.signal.aborted || response.destroyed) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Falha na extração.';
      if (!response.headersSent) {
        sendHttpError(response, error);
      } else {
        response.end(JSON.stringify({ type: 'error', error: message }) + '\n');
      }
    } finally {
      response.off('close', onClose);
    }
  }

  private startStreamingResponse(response: Response): void {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store, no-transform');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
  }

  private async sendEvent(response: Response, event: object, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const canContinueWriting = response.write(JSON.stringify(event) + '\n');
    if (!canContinueWriting) {
      await once(response, 'drain', { signal });
    }
  }
}
