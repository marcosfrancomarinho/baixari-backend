import { Protocol } from '../../domain/entities/protocol.js';
import type { FileExistenceChecker } from '../../domain/gateway/file.existence.checker.js';
import type { DownloadOutputStrategyFactory } from '../factory/download.output.strategy.factory.js';
import type { InputProtocol, OutputProtocol } from '../dto/dto.protocol.js';

export class ProtocolFileDownloaderUseCase {
  public constructor(
    private fileExistenceChecker: FileExistenceChecker,
    private outputStrategyFactory: DownloadOutputStrategyFactory,
  ) {}

  public async dowload(input: InputProtocol): Promise<OutputProtocol> {
    const strategy = this.outputStrategyFactory.create(input.format);
    const protocol = Protocol.create(input.number);
    const path = await this.fileExistenceChecker.checkProtocol(protocol);
    return strategy.generate(path);
  }
}
