import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { PDFDocument } from 'pdf-lib';
import { FsFileExistenceChecker } from '../src/infra/fs.file.existence.checker.js';
import { ArchiverZipServices } from '../src/infra/archiver.zip.services.js';
import { PdfLibServices } from '../src/infra/pdf.lib.services.js';
import { ProtocolFileDownloaderUseCase } from '../src/app/usecase/protocol.file.downloader.usecase.js';
import { CertificateFileDownloaderUseCase } from '../src/app/usecase/certificate.file.downloader.usecase.js';
import { ProtocolFileDownloaderController } from '../src/presentation/controllers/protocol.file.downloader.controller.js';
import { CertificateFileDownloaderController } from '../src/presentation/controllers/certificate.file.downloader.controller.js';
import { Routers } from '../src/presentation/routers/routers.js';
import { DownloadOutputStrategyFactory } from '../src/app/factory/download.output.strategy.factory.js';
import { ZipDownloadOutputStrategy } from '../src/app/strategy/zip.download.output.strategy.js';
import { PdfDownloadOutputStrategy } from '../src/app/strategy/pdf.download.output.strategy.js';

test('ZIP, merged PDF, original PDF and invalid inputs on both routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baixari-test-'));
  const checker = new FsFileExistenceChecker(root, root);
  const zip = new ArchiverZipServices();
  const pdf = new PdfLibServices();
  const factory = new DownloadOutputStrategyFactory(
    new ZipDownloadOutputStrategy(zip),
    new PdfDownloadOutputStrategy(pdf),
  );
  const app = express();
  new Routers(
    new ProtocolFileDownloaderController(new ProtocolFileDownloaderUseCase(checker, factory)),
    new CertificateFileDownloaderController(new CertificateFileDownloaderUseCase(checker, factory)),
  ).setup(app);
  const server = app.listen(0, '127.0.0.1');
  try {
    await mkdir(join(root, '1', 'nested'), { recursive: true });
    await mkdir(join(root, '2'));
    await mkdir(join(root, '3'));
    const first = await PDFDocument.create();
    first.addPage([200, 300]);
    const bytes = await first.save();
    await writeFile(join(root, '1', '2.PDF'), bytes);
    await writeFile(join(root, '3', 'only.pdf'), bytes);
    const second = await PDFDocument.create();
    second.addPage([400, 500]);
    second.addPage([600, 700]);
    await writeFile(join(root, '1', 'nested', '10.pdf'), await second.save());
    await writeFile(join(root, '1', 'ignore.txt'), 'not a PDF');
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    for (const route of ['protocol', 'certificate']) {
      const base = `http://127.0.0.1:${address.port}/${route}`;
      for (const query of ['', '?format=zip']) {
        const response = await fetch(`${base}/1${query}`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'application/zip');
        assert.equal(Buffer.from(await response.arrayBuffer()).subarray(0, 2).toString(), 'PK');
      }
      const response = await fetch(`${base}/1?format=pdf`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('content-disposition'), `attachment; filename=${route}_1.pdf`);
      const merged = await PDFDocument.load(await response.arrayBuffer());
      assert.deepEqual(merged.getPages().map(page => page.getWidth()), [200, 400, 600]);
      const single = await fetch(`${base}/3?format=pdf`);
      assert.deepEqual(Buffer.from(await single.arrayBuffer()), Buffer.from(bytes));
      for (const query of ['format=rar', 'format=pdf&format=zip', 'format=']) {
        assert.equal((await fetch(`${base}/1?${query}`)).status, 400);
      }
      assert.equal((await fetch(`${base}/2?format=pdf`)).status, 404);
      assert.equal((await fetch(`${base}/999?format=pdf`)).status, 404);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
