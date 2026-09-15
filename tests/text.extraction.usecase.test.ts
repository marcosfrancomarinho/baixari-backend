import { join } from 'node:path';
import { InvalidInputError } from '../src/app/input/invalid.input.error.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';

test('text use case chooses the correct directory, validates input and forwards cancellation', async () => {
  const calls: string[] = [];
  const cancellation = new AbortController();
  const usecase = new TextExtractionUseCase({
    getBasePath(input) { return input.kind; },
    async isDirectory(path) { calls.push(path.path); return true; },
    async listFiles() { return ['document.pdf']; },
  }, {
    async *extract(input, signal) {
      assert.deepEqual(input.files, ['document.pdf']);
      assert.equal(signal, cancellation.signal);
      yield { file: input.directory.path, page: 1, totalPages: 1, text: 'text' };
    },
  });
  for (const kind of ['protocol', 'certificate'] as const) {
    const pages = await usecase.execute({ kind, number: 123 }, cancellation.signal);
    assert.equal((await pages.next()).value?.file, join(kind, '123'));
    await pages.return(undefined);
  }
  assert.deepEqual(calls, [join('protocol', '123'), join('certificate', '123')]);
  for (const number of [NaN, 0, -1, 1.5, Infinity]) {
    await assert.rejects(usecase.execute({ kind: 'protocol', number }), InvalidInputError);
  }
  cancellation.abort();
  await assert.rejects(usecase.execute({ kind: 'protocol', number: 123 }, cancellation.signal), { name: 'AbortError' });
  assert.equal(calls.length, 2);
});
