import { PassThrough, Readable } from 'stream';
import type { ZipServices } from '../app/contracts/zip.services.js';
import type { DocumentFiles } from '../app/model/document.files.js';
import archiver from 'archiver';

export class ArchiverZipServices implements ZipServices {
  public async generate(documentFiles: DocumentFiles): Promise<Readable> {
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
    archive.directory(documentFiles.directory, false);
    archive.finalize();
    return stream;
  }
}
