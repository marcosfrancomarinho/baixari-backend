import { extname, join } from 'node:path';
import type { FileSystemGateway } from '../contracts/file.system.gateway.js';
import { DocumentInput } from '../input/document.input.js';
import { DirectoryInput } from '../input/directory.input.js';
import { FilesInput } from '../input/files.input.js';

import type { DownloadOutputStrategyFactory } from '../factory/download.output.strategy.factory.js';
import type { InputProtocol, OutputProtocol } from '../dto/dto.protocol.js';

export class ProtocolFileDownloaderUseCase {
  public constructor(
    private fileSystemGateway: FileSystemGateway,
    private outputStrategyFactory: DownloadOutputStrategyFactory,
  ) {}

  public async dowload(input: InputProtocol): Promise<OutputProtocol> {
    const strategy = this.outputStrategyFactory.create(input.format);
    const document = DocumentInput.create(input.number, 'protocol');
    const base = DirectoryInput.create(this.fileSystemGateway.getBasePath(document));
    const path = DirectoryInput.create(join(base.path, String(document.number)));
    if (!(await this.fileSystemGateway.isDirectory(path))) {
      throw new Error('Protocolo não encontrado.');
    }
    const allFiles = await this.fileSystemGateway.listFiles(path);
    const files =
      (input.format ?? 'zip') === 'zip'
        ? allFiles
        : allFiles.filter((file) => ['.pdf', '.jpg', '.jpeg', '.png'].includes(extname(file).toLowerCase()));
    if (!files.length) {
      throw new Error(
        (input.format ?? 'zip') === 'zip' ? 'Pasta vazia.' : 'Nenhum PDF ou imagem (JPG, JPEG, PNG) encontrado na pasta.',
      );
    }
    return strategy.generate(FilesInput.create(path, files));
  }
}
