import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { FsFileSystemGateway } from '../src/infra/fs.file.system.gateway.js';
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
import { LocalTextExtractionServices } from '../src/infra/local.text.extraction.services.js';
import { TextExtractionController } from '../src/presentation/controllers/text.extraction.controller.js';

test('ZIP, merged PDF, original PDF and invalid inputs on both routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baixari-test-'));
  const checker = new FsFileSystemGateway(root, root);
  const zip = new ArchiverZipServices();
  const pdf = new PdfLibServices();
  const factory = new DownloadOutputStrategyFactory(
    new ZipDownloadOutputStrategy(zip),
    new PdfDownloadOutputStrategy(pdf),
  );
  const app = express();
  for (const usecase of [
    new ProtocolFileDownloaderUseCase(checker, factory),
    new CertificateFileDownloaderUseCase(checker, factory),
  ]) {
    for (const number of [NaN, 0, -1, 1.5, Infinity]) {
      await assert.rejects(usecase.dowload({ number }), /invalido/);
    }
  }
  new Routers(
    new ProtocolFileDownloaderController(new ProtocolFileDownloaderUseCase(checker, factory)),
    new CertificateFileDownloaderController(new CertificateFileDownloaderUseCase(checker, factory)),
    new TextExtractionController(new TextExtractionUseCase(checker, new LocalTextExtractionServices())),
  ).setup(app);
  const server = app.listen(0, '127.0.0.1');
  try {
    await mkdir(join(root, '1', 'nested'), { recursive: true });
    await mkdir(join(root, '2'));
    await mkdir(join(root, '3'));
    await mkdir(join(root, '4'));
    await mkdir(join(root, '5'));
    const png = await readFile(new URL('./fixtures/image.png', import.meta.url));
    const jpg = await readFile(new URL('./fixtures/image.jpg', import.meta.url));
    await writeFile(join(root, '1', '3.PNG'), png);
    await writeFile(join(root, '1', 'nested', '11.JPEG'), jpg);
    await writeFile(join(root, '4', 'only.jpg'), jpg);
    await writeFile(join(root, '5', 'only.png'), png);
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
      for (const number of ['1abc', '1.5', '1e2', '0x10', '-1', '0', '9007199254740992']) {
        assert.equal((await fetch(`${base}/${number}`)).status, 400);
        assert.equal((await fetch(`${base}/${number}/text`)).status, 400);
      }
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
      assert.deepEqual(merged.getPages().map(page => page.getSize()), [
        { width: 200, height: 300 },
        { width: 40, height: 20 },
        { width: 400, height: 500 },
        { width: 600, height: 700 },
        { width: 40, height: 20 },
      ]);
      for (const number of [4, 5]) {
        const imageResponse = await fetch(`${base}/${number}?format=pdf`);
        assert.equal(imageResponse.status, 200);
        assert.equal(imageResponse.headers.get('content-type'), 'application/pdf');
        const imagePdf = await PDFDocument.load(await imageResponse.arrayBuffer());
        assert.equal(imagePdf.getPageCount(), 1);
        assert.deepEqual(imagePdf.getPage(0).getSize(), { width: 40, height: 20 });
        assert.equal(imagePdf.getPage(0).node.Resources()?.lookupMaybe(
          PDFName.of('XObject'), PDFDict,
        )?.keys().length, 1);
      }
      const single = await fetch(`${base}/3?format=pdf`);
      assert.deepEqual(Buffer.from(await single.arrayBuffer()), Buffer.from(bytes));
      for (const query of ['format=docx', 'format=rar', 'format=pdf&format=zip', 'format=']) {
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
