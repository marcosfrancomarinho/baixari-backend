import type { DownloadOutput } from '../strategy/download.output.strategy.js';
import type { DownloadFormat } from './download.format.js';

export interface InputCertificate {
  number: number;
  format?: DownloadFormat;
}

export interface OutputCertificate extends DownloadOutput {}
