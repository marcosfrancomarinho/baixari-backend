import { PdfConversionError } from '../errors/pdf.conversion.error.js';
import type { DocumentUpload } from '../model/document.upload.js';

export class PdfConversionRequest {
  private constructor(public readonly upload: DocumentUpload) {
    Object.freeze(this);
  }

  public static from(input: DocumentUpload): PdfConversionRequest {
    const contentType = input.headers['content-type'];
    const mediaType = typeof contentType === 'string'
      ? contentType.split(';', 1)[0].trim().toLowerCase()
      : undefined;
    if (mediaType !== 'multipart/form-data') {
      throw new PdfConversionError(415, 'Envie multipart/form-data com arquivos no campo files.');
    }
    return new PdfConversionRequest(input);
  }
}
