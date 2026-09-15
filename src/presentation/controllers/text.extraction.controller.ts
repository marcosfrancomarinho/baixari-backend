import { InvalidInputError } from '../../app/input/invalid.input.error.js';
import { DocumentInput } from '../../app/input/document.input.js';
import type { Request, Response } from 'express';
import { once } from 'node:events';
import { type TextExtractionUseCase } from '../../app/usecase/text.extraction.usecase.js';

export class TextExtractionController {
  public constructor(private textExtractionUseCase: TextExtractionUseCase) {}

  public async execute(request: Request, response: Response, kind: 'protocol' | 'certificate'): Promise<void> {
    const cancellation = new AbortController();
    const onClose = () => cancellation.abort();
    response.once('close', onClose);
    const send = async (event: object) => {
      cancellation.signal.throwIfAborted();
      if (!response.write(JSON.stringify(event) + '\n')) {
        await once(response, 'drain', { signal: cancellation.signal });
      }
    };
    try {
      const number = DocumentInput.fromRoute(request.params.number, kind).number;
      const extraction = await this.textExtractionUseCase.execute({ number, kind }, cancellation.signal);
      cancellation.signal.throwIfAborted();
      response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store, no-transform');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();
      await send({ type: 'start' });
      let pages = 0;
      for await (const page of extraction) {
        await send({ type: 'page', ...page });
        pages++;
      }
      await send({ type: 'done', pages });
      response.end();
    } catch (error) {
      if (cancellation.signal.aborted || response.destroyed) return;
      const message = error instanceof Error ? error.message : 'Falha na extração.';
      if (!response.headersSent) response.status(error instanceof InvalidInputError ? 400 : 404).json({ error: message });
      else response.end(JSON.stringify({ type: 'error', error: message }) + '\n');
    } finally {
      response.off('close', onClose);
    }
  }
}
