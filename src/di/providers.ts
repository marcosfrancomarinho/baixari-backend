import { resolve } from 'node:path';

import { AppConfig, createApplicationContext } from '../../kit-dev/di/container.js';

import { FileSystemGateway } from '../app/contracts/file.system.gateway.js';
import { PdfServices } from '../app/contracts/pdf.services.js';
import { TextExtractionServices } from '../app/contracts/text.extraction.services.js';
import { ZipServices } from '../app/contracts/zip.services.js';
import { DownloadOutputStrategyFactory } from '../app/factory/download.output.strategy.factory.js';
import { DocumentFilesFinder } from '../app/services/document.files.finder.js';
import { PdfDownloadOutputStrategy } from '../app/strategy/pdf.download.output.strategy.js';
import { ZipDownloadOutputStrategy } from '../app/strategy/zip.download.output.strategy.js';
import { FileDownloaderUseCase } from '../app/usecase/file.downloader.usecase.js';
import { TextExtractionUseCase } from '../app/usecase/text.extraction.usecase.js';

import { ArchiverZipServices } from '../infra/archiver.zip.services.js';
import { FsFileSystemGateway } from '../infra/fs.file.system.gateway.js';
import { LocalTextExtractionServices } from '../infra/local.text.extraction.services.js';
import { PdfLibServices } from '../infra/pdf.lib.services.js';

import { FileDownloaderController } from '../presentation/controllers/file.downloader.controller.js';
import { TextExtractionController } from '../presentation/controllers/text.extraction.controller.js';
import { Routers } from '../presentation/routers/routers.js';

import {
  PATH_CERTIFICATE,
  PATH_PROTOCOL,
} from './tokens.js';

const providers = new AppConfig();

providers
  .useValue(PATH_PROTOCOL, resolve('C:\\FoliumGED\\Pedido'))
  .useValue(PATH_CERTIFICATE, resolve('C:\\FoliumGED\\PedidoCertidao'))
  .useClass<FileSystemGateway>(FsFileSystemGateway, [PATH_CERTIFICATE, PATH_PROTOCOL])
  .useClass<ZipServices>(ArchiverZipServices)
  .useClass<PdfServices>(PdfLibServices)
  .useClass<TextExtractionServices>(LocalTextExtractionServices)
  .useClass(ZipDownloadOutputStrategy)
  .useClass(PdfDownloadOutputStrategy)
  .useClass(DownloadOutputStrategyFactory)
  .useClass(DocumentFilesFinder)
  .useClass(FileDownloaderUseCase)
  .useClass(FileDownloaderController)
  .useClass(TextExtractionUseCase)
  .useClass(TextExtractionController)
  .useClass(Routers);

export const container = createApplicationContext(providers);
