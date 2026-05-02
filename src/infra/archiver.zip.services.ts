import { PassThrough, Readable } from 'stream';
import type { Path } from '../domain/entities/path.js';
import type { ZipServices } from '../domain/gateway/zip.services.js';
import archiver from 'archiver';
import fs from 'fs/promises';

export class ArchiverZipServices implements ZipServices {
  public async generateCertificate(path: Path): Promise<Readable> {
    return this.generateZipFromPath(path);
  }

  public async generateProtocol(path: Path): Promise<Readable> {
    return this.generateZipFromPath(path);
  }

  private async generateZipFromPath(path: Path): Promise<Readable> {
    const dir = path.getPath();

    const files = await fs.readdir(dir);

    if (files.length === 0) {
      throw new Error('Pasta vazia.');
    }

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
