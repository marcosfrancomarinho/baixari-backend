import type { Readable } from 'node:stream';

export interface InputCertificate {
  number: number;
}

export interface OutputCertificate {
  stream: Readable;
}
