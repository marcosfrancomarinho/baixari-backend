import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';
import { DocumentRequest } from '../src/app/request/document.request.js';
import { RequestValidationError } from '../src/app/request/request.validation.error.js';
import { DocumentFilesFinder } from '../src/app/services/document.files.finder.js';

test('text use case chooses the correct directory, validates input and forwards cancellation', async () => {
  const calls: string[] = [];
  const cancellation = new AbortController();
  const finder = new DocumentFilesFinder({
    getBasePath(kind) { return kind; },
    async isDirectory(path) { calls.push(path); return true; },
    async listFiles() { return ['document.pdf']; },
  });
  const usecase = new TextExtractionUseCase(finder, {
    async *extract(documentFiles, signal) {
      assert.deepEqual(documentFiles.files, ['document.pdf']);
      assert.equal(signal, cancellation.signal);
      yield { file: documentFiles.directory, page: 1, totalPages: 1, text: 'text' };
    },
  });
  for (const kind of ['protocol', 'certificate'] as const) {
    const request = DocumentRequest.forText({ kind, number: 123 });
    const pages = await usecase.execute(request, cancellation.signal);
    assert.equal((await pages.next()).value?.file, join(kind, '123'));
    await pages.return(undefined);
  }
  assert.deepEqual(calls, [join('protocol', '123'), join('certificate', '123')]);
  for (const number of [NaN, 0, -1, 1.5, Infinity]) {
    assert.throws(
      () => DocumentRequest.forText({ kind: 'protocol', number }),
      RequestValidationError,
    );
  }
  cancellation.abort();
  const request = DocumentRequest.forText({ kind: 'protocol', number: 123 });
  await assert.rejects(usecase.execute(request, cancellation.signal), { name: 'AbortError' });
  assert.equal(calls.length, 2);
});
