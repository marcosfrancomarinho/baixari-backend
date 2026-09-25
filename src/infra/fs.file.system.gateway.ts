import { stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileSystemGateway } from '../app/contracts/file.system.gateway.js';
import type { DocumentKind } from '../app/request/document.request.js';

export class FsFileSystemGateway implements FileSystemGateway {
  public constructor(
    private readonly certificateBasePath: string,
    private readonly protocolBasePath: string,
  ) { }

  public getBasePath(kind: DocumentKind): string {
    return kind === 'protocol' ? this.protocolBasePath : this.certificateBasePath;
  }

  public async isDirectory(path: string): Promise<boolean> {
    try {
      return (await stat(path)).isDirectory();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') {
        return false;
      }
      throw error;
    }
  }

  public async listFiles(path: string): Promise<string[]> {
    return this.listDirectory(path);
  }

  private async listDirectory(path: string): Promise<string[]> {
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((first, second) => first.name.localeCompare(second.name, 'pt-BR', { numeric: true }));
    const files: string[] = [];
    for (const entry of entries) {
      const entryPath = join(path, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listDirectory(entryPath));
      } else if (entry.isFile()) {
        files.push(entryPath);
      }
    }
    return files;
  }
}
