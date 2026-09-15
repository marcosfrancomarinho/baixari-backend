import type { Request, Response } from 'express';
import { once } from 'node:events';
import type { FileExistenceChecker } from '../../domain/gateway/file.existence.checker.js';
import type { WordServices } from '../../domain/gateway/word.services.js';
import { Protocol } from '../../domain/entities/protocol.js';
import { Certificate } from '../../domain/entities/certificate.js';

export class TextExtractionController {
  public constructor(private fileExistenceChecker: FileExistenceChecker, private wordServices: WordServices) {}

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
      const number = Number(request.params.number);
      if (!Number.isSafeInteger(number) || number <= 0) {
        response.status(400).json({ error: 'Número inválido.' });
        return;
      }
      const path = kind === 'protocol'
        ? await this.fileExistenceChecker.checkProtocol(Protocol.create(number))
        : await this.fileExistenceChecker.checkCertificate(Certificate.create(number));
      cancellation.signal.throwIfAborted();
      response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store, no-transform');
      response.setHeader('X-Accel-Buffering', 'no');
      response.flushHeaders();
      await send({ type: 'start' });
      let pages = 0;
      for await (const page of this.wordServices.extract(path, cancellation.signal)) {
        await send({ type: 'page', ...page });
        pages++;
      }
      await send({ type: 'done', pages });
      response.end();
    } catch (error) {
      if (cancellation.signal.aborted || response.destroyed) return;
      const message = error instanceof Error ? error.message : 'Falha na extração.';
      if (!response.headersSent) response.status(404).json({ error: message });
      else response.end(JSON.stringify({ type: 'error', error: message }) + '\n');
    } finally {
      response.off('close', onClose);
    }
  }
}
