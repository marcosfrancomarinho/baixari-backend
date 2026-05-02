import { Protocol } from '../../domain/entities/protocol.js';
import type { FileExistenceChecker } from '../../domain/gateway/file.existence.checker.js';
import type { ZipServices } from '../../domain/gateway/zip.services.js';
import type { InputProtocol, OutputProtocol } from '../dto/dto.protocol.js';

export class ProtocolFileDownloaderUseCase {
  public constructor(
    private fileExistenceChecker: FileExistenceChecker,
    private zipServices: ZipServices,
  ) {}

  public async dowload(input: InputProtocol): Promise<OutputProtocol> {
    const protocol = Protocol.create(input.number);
    const path = await this.fileExistenceChecker.checkProtocol(protocol);
    const stream = await this.zipServices.generateProtocol(path);
    return { stream };
  }
}
