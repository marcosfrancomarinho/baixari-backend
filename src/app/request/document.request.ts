import { extname, join } from 'node:path';
import { DocumentNotFoundError } from '../errors/document.not-found.error.js';
import { RequestValidationError } from './request.validation.error.js';

export type DocumentKind = 'protocol' | 'certificate';
export type DownloadFormat = 'zip' | 'pdf';
export type DocumentFormat = DownloadFormat | 'text';

interface RawDocumentRequest {
  number: unknown;
  kind: unknown;
}

interface RawDownloadRequest extends RawDocumentRequest {
  format: unknown;
}

const SUPPORTED_MEDIA_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);

export class DocumentRequest<TFormat extends DocumentFormat> {
  private constructor(
    public readonly number: number,
    public readonly kind: DocumentKind,
    public readonly format: TFormat,
  ) {
    Object.freeze(this);
  }

  public static forDownload(request: RawDownloadRequest): DocumentRequest<DownloadFormat> {
    return new DocumentRequest(
      parseDocumentNumber(request.number),
      parseDocumentKind(request.kind),
      parseDownloadFormat(request.format),
    );
  }

  public static forText(request: RawDocumentRequest): DocumentRequest<'text'> {
    return new DocumentRequest(
      parseDocumentNumber(request.number),
      parseDocumentKind(request.kind),
      'text',
    );
  }

  public resolveDirectory(basePath: unknown): string {
    if (typeof basePath !== 'string' || !basePath.trim() || basePath.includes('\0')) {
      throw new RequestValidationError('Caminho invalido. Use uma string nao vazia.');
    }

    return join(basePath.trim(), String(this.number));
  }

  public selectFiles(files: unknown): readonly string[] {
    if (!Array.isArray(files)) {
      throw new RequestValidationError('Lista de arquivos invalida.');
    }

    const validPaths = files.map(validateFilePath);
    const selectedFiles = this.format === 'zip'
      ? validPaths
      : validPaths.filter((file) => SUPPORTED_MEDIA_EXTENSIONS.has(extname(file).toLowerCase()));

    if (selectedFiles.length === 0) {
      const message = this.format === 'zip'
        ? 'Pasta vazia.'
        : 'Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.';
      throw new DocumentNotFoundError(message);
    }

    return Object.freeze(selectedFiles);
  }

  public get notFoundMessage(): string {
    return this.kind === 'protocol' ? 'Protocolo não encontrado.' : 'Certidao não encontrada.';
  }
}

function parseDocumentNumber(value: unknown): number {
  if (typeof value === 'string') {
    if (!/^\d+$/.test(value)) {
      throw new RequestValidationError('Numero invalido. Use apenas digitos.');
    }

    return validatePositiveInteger(Number(value));
  }

  return validatePositiveInteger(value);
}

function validatePositiveInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new RequestValidationError('Numero invalido. Use um inteiro positivo.');
  }

  return value;
}

function parseDocumentKind(value: unknown): DocumentKind {
  if (value !== 'protocol' && value !== 'certificate') {
    throw new RequestValidationError('Tipo invalido. Use protocol ou certificate.');
  }

  return value;
}

function parseDownloadFormat(value: unknown): DownloadFormat {
  if (value === undefined || value === 'zip') return 'zip';
  if (value === 'pdf') return 'pdf';

  throw new RequestValidationError('Formato invalido. Use zip ou pdf.');
}

function validateFilePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
    throw new RequestValidationError('Caminho de arquivo invalido. Use uma string nao vazia.');
  }

  return value.trim();
}
