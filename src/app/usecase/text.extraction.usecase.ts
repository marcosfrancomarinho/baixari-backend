import type { TextExtractionServices } from '../contracts/text.extraction.services.js';
import type { DocumentRequest } from '../request/document.request.js';
import type { DocumentFilesFinder } from '../services/document.files.finder.js';

export class TextExtractionUseCase {
  public constructor(
    private readonly documentFilesFinder: DocumentFilesFinder,
    private readonly textExtractionServices: TextExtractionServices,
  ) {}

  public async execute(request: DocumentRequest<'text'>, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const documentFiles = await this.documentFilesFinder.find(request);
    signal?.throwIfAborted();

    return this.textExtractionServices.extract(documentFiles, signal);
  }
}
