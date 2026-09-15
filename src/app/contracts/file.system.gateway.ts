import type { DocumentKind } from '../request/document.request.js';

export interface FileSystemGateway {
  getBasePath(kind: DocumentKind): string;
  isDirectory(path: string): Promise<boolean>;
  listFiles(path: string): Promise<string[]>;
}
