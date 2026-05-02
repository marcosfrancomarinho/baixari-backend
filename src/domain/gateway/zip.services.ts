import { Readable } from 'stream';
import type { Path } from '../valuesobject/path.js';

export interface ZipServices {
  generate(path: Path): Promise<Readable>;
}
