import type { Response } from 'express';
import { DocumentNotFoundError } from '../../app/errors/document.not-found.error.js';
import { RequestValidationError } from '../../app/request/request.validation.error.js';

export function sendHttpError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Erro interno do servidor.';

  if (error instanceof RequestValidationError) {
    response.status(400).json({ error: message });
    return;
  }

  if (error instanceof DocumentNotFoundError) {
    response.status(404).json({ error: message });
    return;
  }

  console.error(error);
  response.status(500).json({ error: message });
}
