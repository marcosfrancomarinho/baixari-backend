import type { PdfConversionGateway } from '../app/contracts/pdf.conversion.gateway.js';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { PdfConversionError } from '../app/errors/pdf.conversion.error.js';
import { imageWorker } from './pdf.image.worker.js';
import type { ConversionConfig } from './pdf.conversion.config.js';

export class DiskPdfConversion implements PdfConversionGateway {
  public constructor(private readonly config: ConversionConfig) { }

  public async check(signal: AbortSignal): Promise<void> {
    await this.runProcess(this.config.ghostscript, ['--version'], signal);
  }

  public async convert(directory: string, documentCount: number, signal: AbortSignal): Promise<string> {
    await this.prepareDocuments(directory, documentCount, signal);
    await this.mergeDocuments(directory, signal);
    return join(directory, 'result.pdf');
  }

  private async prepareDocuments(directory: string, documentCount: number, signal: AbortSignal): Promise<void> {
    const workerArguments = [
      '--max-old-space-size=192',
      '-e', imageWorker,
      directory,
      String(documentCount),
      String(this.config.maxImagePixels),
      String(this.config.imageMaxSide),
    ];
    await this.runProcess(process.execPath, workerArguments, signal);
  }

  private async mergeDocuments(directory: string, signal: AbortSignal): Promise<void> {
    const ghostscriptArguments = [
      '-dSAFER',
      '-dBATCH',
      '-dNOPAUSE',
      '-dQUIET',
      '-dPDFSTOPONERROR',
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.7',
      // Evita acumular em memoria uma tabela com todas as imagens do documento.
      '-dDetectDuplicateImages=false',
      '-sOutputFile=result.pdf',
      '@inputs.txt',
    ];
    await this.runProcess(this.config.ghostscript, ghostscriptArguments, signal, directory);
  }

  private runProcess(command: string, args: string[], signal: AbortSignal, workingDirectory?: string): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: workingDirectory,
        windowsHide: true,
        stdio: 'ignore',
        shell: false,
        env: workingDirectory
          ? { ...process.env, TMP: workingDirectory, TEMP: workingDirectory, TMPDIR: workingDirectory }
          : process.env,
      });
      let startupError: unknown;
      const cancel = () => {
        child.kill('SIGKILL');
      };
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();

      child.once('error', error => {
        startupError = error;
      });
      child.once('close', exitCode => {
        signal.removeEventListener('abort', cancel);
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        if (startupError) {
          reject(new PdfConversionError(503, 'Conversor indisponivel. Verifique GHOSTSCRIPT_PATH e as dependencias.'));
          return;
        }
        if (exitCode !== 0) {
          reject(new PdfConversionError(422, 'Documento invalido, protegido, nao suportado ou acima dos recursos de conversao.'));
          return;
        }
        resolve();
      });
    });
  }
}
