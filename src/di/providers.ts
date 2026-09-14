import { AppConfig, createApplicationContext } from '../../kit-dev/di/container.js';
import { CertificateFileDownloaderUseCase } from '../app/usecase/certificate.file.downloader.usecase.js';
import { ProtocolFileDownloaderUseCase } from '../app/usecase/protocol.file.downloader.usecase.js';
import { FileExistenceChecker } from '../domain/gateway/file.existence.checker.js';
import { ZipServices } from '../domain/gateway/zip.services.js';
import { ArchiverZipServices } from '../infra/archiver.zip.services.js';
import { PdfServices } from '../domain/gateway/pdf.services.js';
import { PdfLibServices } from '../infra/pdf.lib.services.js';
import { FsFileExistenceChecker } from '../infra/fs.file.existence.checker.js';
import { CertificateFileDownloaderController } from '../presentation/controllers/certificate.file.downloader.controller.js';
import { ProtocolFileDownloaderController } from '../presentation/controllers/protocol.file.downloader.controller.js';
import { Routers } from '../presentation/routers/routers.js';
import { PATH_CERTIFICATE, PATH_PROTOCOL } from './tokens.js';
import { join } from 'node:path';
import { DownloadOutputStrategyFactory } from '../app/factory/download.output.strategy.factory.js';
import { ZipDownloadOutputStrategy } from '../app/strategy/zip.download.output.strategy.js';
import { PdfDownloadOutputStrategy } from '../app/strategy/pdf.download.output.strategy.js';

const providers = new AppConfig();

providers
  .useValue(PATH_PROTOCOL, join(process.cwd(), '/files/protocols'))
  .useValue(PATH_CERTIFICATE, join(process.cwd(), '/files/certificates'))
  .useClass<FileExistenceChecker>(FsFileExistenceChecker, [PATH_CERTIFICATE, PATH_PROTOCOL])
  .useClass<ZipServices>(ArchiverZipServices)
  .useClass<PdfServices>(PdfLibServices)
  .useClass(ZipDownloadOutputStrategy)
  .useClass(PdfDownloadOutputStrategy)
  .useClass(DownloadOutputStrategyFactory)
  .useClass(ProtocolFileDownloaderUseCase)
  .useClass(CertificateFileDownloaderUseCase)
  .useClass(ProtocolFileDownloaderController)
  .useClass(CertificateFileDownloaderController)
  .useClass(Routers);

export const container = createApplicationContext(providers);
