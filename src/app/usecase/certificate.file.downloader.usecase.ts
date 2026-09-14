import { Certificate } from '../../domain/entities/certificate.js';
import type { FileExistenceChecker } from '../../domain/gateway/file.existence.checker.js';
import type { DownloadOutputStrategyFactory } from '../factory/download.output.strategy.factory.js';
import type { InputCertificate, OutputCertificate } from '../dto/dto.certificate.js';

export class CertificateFileDownloaderUseCase {
  public constructor(
    private fileExistenceChecker: FileExistenceChecker,
    private outputStrategyFactory: DownloadOutputStrategyFactory,
  ) {}

  public async dowload(input: InputCertificate): Promise<OutputCertificate> {
    const strategy = this.outputStrategyFactory.create(input.format);
    const certificate = Certificate.create(input.number);
    const path = await this.fileExistenceChecker.checkCertificate(certificate);
    return strategy.generate(path);
  }
}
