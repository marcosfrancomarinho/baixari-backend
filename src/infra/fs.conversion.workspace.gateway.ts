import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConversionWorkspaceGateway } from '../app/contracts/conversion.workspace.gateway.js';
import type { ConvertedPdf } from '../app/model/document.upload.js';
import { PdfConversionError } from '../app/errors/pdf.conversion.error.js';
import type { ConversionConfig } from './pdf.conversion.config.js';

const DISK_MONITOR_INTERVAL_MS = 1000;

export class FsConversionWorkspaceGateway implements ConversionWorkspaceGateway {
  public constructor(private readonly config: ConversionConfig) { }

  public async checkSpace(directory: string): Promise<void> {
    const space = await statfs(directory, { bigint: true });
    if (space.bavail * space.bsize < BigInt(this.config.minFreeBytes)) {
      throw new PdfConversionError(507, 'Espaco insuficiente no disco para converter os documentos.');
    }
  }

  public async create(): Promise<string> {
    await mkdir(this.config.tempRoot, { recursive: true });
    await this.checkSpace(this.config.tempRoot);
    return mkdtemp(join(this.config.tempRoot, 'baixari-pdf-'));
  }

  public watch(directory: string, onError: (error: unknown) => void): () => void {
    let isCheckingSpace = false;
    let isMonitoringStopped = false;
    const monitorTimer = setInterval(() => {
      if (isCheckingSpace) return;
      isCheckingSpace = true;

      this.checkSpace(directory)
        .catch(error => {
          if (!isMonitoringStopped) onError(error);
        })
        .finally(() => {
          isCheckingSpace = false;
        });
    }, DISK_MONITOR_INTERVAL_MS);

    return () => {
      isMonitoringStopped = true;
      clearInterval(monitorTimer);
    };
  }

  public async openOutput(path: string): Promise<ConvertedPdf> {
    const { size } = await stat(path);
    return { size, stream: createReadStream(path) };
  }

  public async remove(directory: string): Promise<void> {
    await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      .catch(error => console.error('Falha ao remover temporarios da conversao:', error));
  }
}
