import { Certificate } from '../../domain/entities/certificate.js';
import type { FileExistenceChecker } from '../../domain/gateway/file.existence.checker.js';
import type { ZipServices } from '../../domain/gateway/zip.services.js';
import type { InputCertificate, OutputCertificate } from '../dto/dto.certificate.js';

export class CertificateFileDownloaderUseCase {
  public constructor(
    private fileExistenceChecker: FileExistenceChecker,
    private zipServices: ZipServices,
  ) {}

  public async dowload(input: InputCertificate): Promise<OutputCertificate> {
    const certificate = Certificate.create(input.number);
    const path = await this.fileExistenceChecker.checkCertificate(certificate);
    const stream = await this.zipServices.generate(path);
    return { stream };
  }
}
