import type { FilesInput } from '../app/input/files.input.js';
import { PassThrough, Readable } from 'stream';
import type { ZipServices } from '../app/contracts/zip.services.js';
import archiver from 'archiver';

export class ArchiverZipServices implements ZipServices {
  public async generate(input: FilesInput): Promise<Readable> {
    const dir = input.directory.path;
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });
    const stream = new PassThrough();
    archive.on('error', (err) => {
      stream.destroy(err);
    });
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Arquivo ignorado:', err.message);
      } else {
        stream.destroy(err);
      }
    });
    archive.pipe(stream);
    archive.directory(dir, false);
    archive.finalize();
    return stream;
  }
}
