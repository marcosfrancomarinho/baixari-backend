import type { FileSystemGateway } from '../contracts/file.system.gateway.js';
import { DocumentNotFoundError } from '../errors/document.not-found.error.js';
import type { DocumentFiles } from '../model/document.files.js';
import type { DocumentFormat, DocumentRequest } from '../request/document.request.js';

export class DocumentFilesFinder {
  public constructor(private readonly fileSystemGateway: FileSystemGateway) {}

  public async find<TFormat extends DocumentFormat>(request: DocumentRequest<TFormat>): Promise<DocumentFiles> {
    const basePath = this.fileSystemGateway.getBasePath(request.kind);
    const directory = request.resolveDirectory(basePath);

    if (!(await this.fileSystemGateway.isDirectory(directory))) {
      throw new DocumentNotFoundError(request.notFoundMessage);
    }

    const files = request.selectFiles(await this.fileSystemGateway.listFiles(directory));
    return Object.freeze({ directory, files });
  }
}
