import type { Readable } from 'node:stream';

export interface InputProtocol {
  number: number;
}

export interface OutputProtocol {
  stream: Readable;
}
