import type { DownloadOutput } from '../strategy/download.output.strategy.js';
import type { DownloadFormat } from './download.format.js';

export interface InputProtocol {
  number: number;
  format?: DownloadFormat;
}

export interface OutputProtocol extends DownloadOutput {}
