import type { Response } from 'express';
import { DocumentNotFoundError } from '../../app/errors/document.not-found.error.js';
import { RequestValidationError } from '../../app/request/request.validation.error.js';
import { PdfConversionError } from '../../app/errors/pdf.conversion.error.js';

export function sendPdfConversionHttpError(response: Response, error: unknown): void {
  if (error instanceof PdfConversionError) {
    if (error.retryAfter) response.setHeader('Retry-After', String(error.retryAfter));
    response.status(error.status).json({ error: error.message });
    return;
  }
  if ((error as NodeJS.ErrnoException)?.code === 'ENOSPC') {
    response.status(507).json({ error: 'Espaco insuficiente no disco.' });
    return;
  }
  console.error('Falha na conversao de PDF:', error);
  response.status(500).json({ error: 'Nao foi possivel processar os documentos.' });
}

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
