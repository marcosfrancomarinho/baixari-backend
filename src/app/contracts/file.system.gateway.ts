import type { DocumentInput } from '../input/document.input.js';
import type { DirectoryInput } from '../input/directory.input.js';
export interface FileSystemGateway {
  getBasePath(input: DocumentInput): string;
  isDirectory(input: DirectoryInput): Promise<boolean>;
  listFiles(input: DirectoryInput): Promise<string[]>;
}
