import { PassThrough, type Readable } from 'node:stream';
import type { ZipServices } from '../app/contracts/zip.services.js';
import type { DocumentFiles } from '../app/model/document.files.js';
import archiver from 'archiver';

export class ArchiverZipServices implements ZipServices {
  public async generate(documentFiles: DocumentFiles): Promise<Readable> {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });
    const outputStream = new PassThrough();
    archive.on('error', (error) => {
      outputStream.destroy(error);
    });
    archive.on('warning', (error) => {
      if (error.code === 'ENOENT') {
        console.warn('Arquivo ignorado:', error.message);
      } else {
        outputStream.destroy(error);
      }
    });
    archive.pipe(outputStream);
    archive.directory(documentFiles.directory, false);
    archive.finalize();
    return outputStream;
  }
}
