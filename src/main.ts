import express from 'express';
import cors from 'cors';
import { ArchiverZipServices } from './infra/archiver.zip.services.js';
import { FsFileExistenceChecker } from './infra/fs.file.existence.checker.js';
import { ProtocolFileDownloaderUseCase } from './app/usecase/protocol.file.downloader.usecase.js';
import { CertificateFileDownloaderUseCase } from './app/usecase/certificate.file.downloader.usecase.js';
import { ProtocolFileDownloaderController } from './presentation/controllers/protocol.file.downloader.controller.js';
import { CertificateFileDownloaderController } from './presentation/controllers/certificate.file.downloader.controller.js';
import { Routers } from './presentation/routers/routers.js';

function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  app.use(cors());
  app.use(express.json());

  const zipServices = new ArchiverZipServices();
  const fileExistenceChecker = new FsFileExistenceChecker();
  const protocolFileDownloaderUseCase = new ProtocolFileDownloaderUseCase(fileExistenceChecker, zipServices);
  const certificateFileDownloaderUseCase = new CertificateFileDownloaderUseCase(fileExistenceChecker, zipServices);
  const protcolFileDownloaderController = new ProtocolFileDownloaderController(protocolFileDownloaderUseCase);
  const certificateFileDownloaderController = new CertificateFileDownloaderController(certificateFileDownloaderUseCase);
  const routers = new Routers(protcolFileDownloaderController, certificateFileDownloaderController);

  routers.setup(app);
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main();
