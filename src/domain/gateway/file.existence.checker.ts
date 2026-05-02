import type { Certificate } from '../entities/certificate.js';
import type { Path } from '../entities/path.js';
import type { Protocol } from '../entities/protocol.js';

export interface FileExistenceChecker {
  checkProtocol(protocol: Protocol): Promise<Path>;
  checkCertificate(certificate: Certificate): Promise<Path>;
}
