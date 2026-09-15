import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { FileDownloaderUseCase } from '../src/app/usecase/file.downloader.usecase.js';
import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';
import { DownloadOutputStrategyFactory } from '../src/app/factory/download.output.strategy.factory.js';
import { PdfDownloadOutputStrategy } from '../src/app/strategy/pdf.download.output.strategy.js';
import { ZipDownloadOutputStrategy } from '../src/app/strategy/zip.download.output.strategy.js';
import type { DocumentFiles } from '../src/app/model/document.files.js';
import { DocumentRequest, type DocumentKind } from '../src/app/request/document.request.js';
import { RequestValidationError } from '../src/app/request/request.validation.error.js';
import { DocumentFilesFinder } from '../src/app/services/document.files.finder.js';

test('document requests validate and select filesystem results before processing', async () => {
  let base = 'files';
  let exists = true;
  let files: string[] = [];
  let reads = 0;
  let received: DocumentFiles | undefined;
  const gateway = {
    getBasePath(_kind: DocumentKind) { return base; },
    async isDirectory() { return exists; },
    async listFiles() { reads++; return files; },
  };
  const service = { async generate(documentFiles: DocumentFiles) { received = documentFiles; return Readable.from([]); } };
  const factory = new DownloadOutputStrategyFactory(new ZipDownloadOutputStrategy(service), new PdfDownloadOutputStrategy(service));
  const finder = new DocumentFilesFinder(gateway);
  const usecase = new FileDownloaderUseCase(finder, factory);

  for (const kind of ['protocol', 'certificate'] as const) {
    const zipRequest = DocumentRequest.forDownload({ number: 123, kind, format: 'zip' });
    const pdfRequest = DocumentRequest.forDownload({ number: 123, kind, format: 'pdf' });

    base = '';
    reads = 0;
    received = undefined;
    await assert.rejects(usecase.execute(zipRequest), RequestValidationError);
    assert.equal(reads, 0);
    base = 'files';
    exists = false;
    await assert.rejects(usecase.execute(zipRequest));
    assert.equal(reads, 0);
    exists = true;
    files = [];
    await assert.rejects(usecase.execute(zipRequest), /Pasta vazia/);
    files = ['notes.txt'];
    await assert.rejects(usecase.execute(pdfRequest), /Nenhum PDF/);
    assert.equal(received, undefined);
    await usecase.execute(zipRequest);
    assert.deepEqual(received?.files, ['notes.txt']);
    files = ['2.PDF', 'notes.txt', 'nested/3.PNG'];
    await usecase.execute(pdfRequest);
    assert.deepEqual(received?.files, ['2.PDF', 'nested/3.PNG']);
  }

  const extraction = new TextExtractionUseCase(finder, {
    async *extract(documentFiles) { received = documentFiles; },
  });
  received = undefined;
  files = ['notes.txt'];
  await assert.rejects(
    extraction.execute(DocumentRequest.forText({ number: 123, kind: 'protocol' })),
    /Nenhum PDF/,
  );
  assert.equal(received, undefined);
});
