import fs from 'fs/promises';
import { join } from 'node:path';
import type { Certificate } from '../domain/entities/certificate.js';
import { Path } from '../domain/valuesobject/path.js';
import type { Protocol } from '../domain/entities/protocol.js';
import type { FileExistenceChecker } from '../domain/gateway/file.existence.checker.js';

export class FsFileExistenceChecker implements FileExistenceChecker {
  public constructor(
    private pathCertificate: string,
    private pathProtocol: string,
  ) {}
  public async checkCertificate(certificate: Certificate): Promise<Path> {
    const directory = join(this.pathCertificate, certificate.getNumber().toString());
    return this.ensureDirectoryExists(directory, 'Certidao não encontrada.');
  }

  public async checkProtocol(protocol: Protocol): Promise<Path> {
    const directory = join(this.pathProtocol, protocol.getNumber().toString());
    return this.ensureDirectoryExists(directory, 'Protocolo não encontrado.');
  }

  private async ensureDirectoryExists(path: string, errorMessage: string): Promise<Path> {
    try {
      const stat = await fs.stat(path);
      if (!stat.isDirectory()) {
        throw new Error(errorMessage);
      }
      return Path.create(path);
    } catch {
      throw new Error(errorMessage);
    }
  }
}
