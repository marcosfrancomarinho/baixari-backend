import type { DocumentInput } from '../app/input/document.input.js';
import { DirectoryInput } from '../app/input/directory.input.js';
import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileSystemGateway } from '../app/contracts/file.system.gateway.js';

export class FsFileSystemGateway implements FileSystemGateway {
  public constructor(private pathCertificate: string, private pathProtocol: string) {}

  public getBasePath(input: DocumentInput): string {
    return input.kind === 'protocol' ? this.pathProtocol : this.pathCertificate;
  }

  public async isDirectory(input: DirectoryInput): Promise<boolean> {
    try {
      return (await stat(input.path)).isDirectory();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return false;
      throw error;
    }
  }

  public async listFiles(input: DirectoryInput): Promise<string[]> {
    return this.listDirectory(input.path);
  }

  private async listDirectory(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
    const files: string[] = [];
    for (const entry of entries) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) files.push(...await this.listDirectory(file));
      else if (entry.isFile()) files.push(file);
    }
    return files;
  }
}
