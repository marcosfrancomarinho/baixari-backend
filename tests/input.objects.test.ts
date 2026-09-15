import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DocumentInput } from '../src/app/input/document.input.js';
import { DirectoryInput } from '../src/app/input/directory.input.js';
import { FilesInput } from '../src/app/input/files.input.js';
import { InvalidInputError } from '../src/app/input/invalid.input.error.js';
import { TextExtractionUseCase } from '../src/app/usecase/text.extraction.usecase.js';

test('input objects reject invalid values and preserve validated data', () => {
  assert.throws(() => DocumentInput.create(0, 'protocol'), InvalidInputError);
  assert.throws(() => DocumentInput.create(123, 'other'), InvalidInputError);
  assert.throws(() => DirectoryInput.create(' '), InvalidInputError);
  const directory = DirectoryInput.create(' files ');
  assert.equal(directory.path, 'files');
  assert.throws(() => FilesInput.create(directory, []), InvalidInputError);
  assert.throws(() => FilesInput.create(directory, ['']), InvalidInputError);
  const original = ['a.pdf'];
  const input = FilesInput.create(directory, original);
  original.push('b.pdf');
  assert.deepEqual(input.files, ['a.pdf']);
  assert.ok(Object.isFrozen(input));
  assert.ok(Object.isFrozen(input.files));
  assert.ok(Object.isFrozen(directory));
  assert.ok(Object.isFrozen(DocumentInput.create(123, 'protocol')));
});

test('use case passes validated objects to filesystem gateway', async () => {
  let received: FilesInput | undefined;
  const usecase = new TextExtractionUseCase({
    getBasePath(input) {
      assert.ok(input instanceof DocumentInput);
      assert.equal(input.number, 123);
      return 'files';
    },
    async isDirectory(input) { assert.ok(input instanceof DirectoryInput); return true; },
    async listFiles(input) { assert.ok(input instanceof DirectoryInput); return ['a.pdf']; },
  }, { async *extract(input) { received = input; } });
  const pages = await usecase.execute({ number: 123, kind: 'protocol' });
  await pages.next();
  const input = received;
  assert.ok(input instanceof FilesInput);
  assert.deepEqual(input.files, ['a.pdf']);
});
