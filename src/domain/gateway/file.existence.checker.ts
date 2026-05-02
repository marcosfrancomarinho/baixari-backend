import type { Certificate } from '../entities/certificate.js';
import type { Protocol } from '../entities/protocol.js';
import type { Path } from '../valuesobject/path.js';

export interface FileExistenceChecker {
  checkProtocol(protocol: Protocol): Promise<Path>;
  checkCertificate(certificate: Certificate): Promise<Path>;
}
