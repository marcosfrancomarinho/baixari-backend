import { extname, join } from 'node:path';
import type { FileSystemGateway } from '../contracts/file.system.gateway.js';
import { DocumentInput } from '../input/document.input.js';
import { DirectoryInput } from '../input/directory.input.js';
import { FilesInput } from '../input/files.input.js';

import type { TextExtractionServices } from '../contracts/text.extraction.services.js';

export class TextExtractionUseCase {
  public constructor(
    private fileSystemGateway: FileSystemGateway,
    private textExtractionServices: TextExtractionServices,
  ) {}

  public async execute(input: { number: number; kind: 'protocol' | 'certificate' }, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const document = DocumentInput.create(input.number, input.kind);
    const base = DirectoryInput.create(this.fileSystemGateway.getBasePath(document));
    const path = DirectoryInput.create(join(base.path, String(document.number)));
    if (!(await this.fileSystemGateway.isDirectory(path))) {
      throw new Error(input.kind === 'protocol' ? 'Protocolo não encontrado.' : 'Certidao não encontrada.');
    }
    signal?.throwIfAborted();
    const allFiles = await this.fileSystemGateway.listFiles(path);
    signal?.throwIfAborted();
    const files = allFiles.filter(file => ['.pdf', '.jpg', '.jpeg', '.png'].includes(extname(file).toLowerCase()));
    if (!files.length) {
      throw new Error('Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.');
    }
    signal?.throwIfAborted();
    return this.textExtractionServices.extract(FilesInput.create(path, files), signal);
  }
}
