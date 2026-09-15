import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { ProtocolFileDownloaderUseCase } from '../src/app/usecase/protocol.file.downloader.usecase.js';
import { CertificateFileDownloaderUseCase } from '../src/app/usecase/certificate.file.downloader.usecase.js';
import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';
import { DownloadOutputStrategyFactory } from '../src/app/factory/download.output.strategy.factory.js';
import { PdfDownloadOutputStrategy } from '../src/app/strategy/pdf.download.output.strategy.js';
import { ZipDownloadOutputStrategy } from '../src/app/strategy/zip.download.output.strategy.js';
import { InvalidInputError } from '../src/app/input/invalid.input.error.js';
import type { FilesInput } from '../src/app/input/files.input.js';

test('each use case validates filesystem results directly before processing', async () => {
  let base = 'files';
  let exists = true;
  let files: string[] = [];
  let reads = 0;
  let received: FilesInput | undefined;
  const gateway = {
    getBasePath() { return base; },
    async isDirectory() { return exists; },
    async listFiles() { reads++; return files; },
  };
  const service = { async generate(input: FilesInput) { received = input; return Readable.from([]); } };
  const factory = new DownloadOutputStrategyFactory(new ZipDownloadOutputStrategy(service), new PdfDownloadOutputStrategy(service));
  for (const usecase of [new ProtocolFileDownloaderUseCase(gateway, factory), new CertificateFileDownloaderUseCase(gateway, factory)]) {
    base = '';
    reads = 0;
    received = undefined;
    await assert.rejects(usecase.dowload({ number: 123 }), InvalidInputError);
    assert.equal(reads, 0);
    base = 'files';
    exists = false;
    await assert.rejects(usecase.dowload({ number: 123 }));
    assert.equal(reads, 0);
    exists = true;
    files = [];
    await assert.rejects(usecase.dowload({ number: 123 }), /Pasta vazia/);
    files = ['notes.txt'];
    await assert.rejects(usecase.dowload({ number: 123, format: 'pdf' }), /Nenhum PDF/);
    assert.equal(received, undefined);
    await usecase.dowload({ number: 123, format: 'zip' });
    assert.deepEqual(received?.files, ['notes.txt']);
    files = ['2.PDF', 'notes.txt', 'nested/3.PNG'];
    await usecase.dowload({ number: 123, format: 'pdf' });
    assert.deepEqual(received?.files, ['2.PDF', 'nested/3.PNG']);
  }
  const extraction = new TextExtractionUseCase(gateway, {
    async *extract(input) { received = input; },
  });
  received = undefined;
  files = ['notes.txt'];
  await assert.rejects(extraction.execute({ number: 123, kind: 'protocol' }), /Nenhum PDF/);
  assert.equal(received, undefined);
});
