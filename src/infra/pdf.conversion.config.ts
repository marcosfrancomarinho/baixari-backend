import { tmpdir } from 'node:os';

export interface ConversionConfig {
  tempRoot: string;
  ghostscript: string;
  maxConcurrent: number;
  maxFileBytes: number;
  maxImagePixels: number;
  imageMaxSide: number;
  minFreeBytes: number;
  uploadIdleMs: number;
}

const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

export function conversionConfig(): ConversionConfig {
  return {
    tempRoot: process.env.PDF_TEMP_DIR || tmpdir(),
    ghostscript: process.env.GHOSTSCRIPT_PATH || (process.platform === 'win32' ? 'gswin64c' : 'gs'),
    maxConcurrent: readPositiveInteger('PDF_MAX_CONCURRENT', 1),
    maxFileBytes: readPositiveInteger('PDF_MAX_FILE_BYTES', 200 * MEBIBYTE),
    maxImagePixels: readPositiveInteger('PDF_MAX_IMAGE_PIXELS', 40_000_000),
    imageMaxSide: readPositiveInteger('PDF_IMAGE_MAX_SIDE', 3000),
    minFreeBytes: readPositiveInteger('PDF_MIN_FREE_BYTES', GIBIBYTE),
    uploadIdleMs: readPositiveInteger('PDF_UPLOAD_IDLE_MS', 60_000),
  };
}

function readPositiveInteger(variableName: string, defaultValue: number): number {
  const value = Number(process.env[variableName] ?? defaultValue);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${variableName} deve ser um inteiro positivo.`);
  }
  return value;
}
