import type { Path } from '../entities/path.js';
import { Readable } from 'stream';

export interface ZipServices {
  generateProtocol(path: Path): Promise<Readable>;
  generateCertificate(path: Path): Promise<Readable>;
}
