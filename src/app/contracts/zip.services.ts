import type { FilesInput } from '../input/files.input.js';
import { Readable } from 'stream';

export interface ZipServices {
  generate(input: FilesInput): Promise<Readable>;
}
