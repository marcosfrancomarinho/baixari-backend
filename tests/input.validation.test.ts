import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InvalidInputError } from '../src/app/input/invalid.input.error.js';
import { DocumentInput } from '../src/app/input/document.input.js';
import { DirectoryInput } from '../src/app/input/directory.input.js';
import { FilesInput } from '../src/app/input/files.input.js';

test('validation rejects invalid runtime values without coercing numbers or accepting partial route IDs', () => {
  for (const value of [null, undefined, '', '123', true, {}, [], NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => DocumentInput.create(value, 'protocol'), InvalidInputError);
  }
  for (const value of ['123abc', '1.5', '1e2', '0x10', '-1', '0', '', ' 1 ', null, undefined, ['1']]) {
    assert.throws(() => DocumentInput.fromRoute(value, 'protocol'), InvalidInputError);
  }
  for (const value of [null, undefined, '', '  ', 123, {}, 'a\0b']) {
    assert.throws(() => DirectoryInput.create(value), InvalidInputError);
  }
  assert.equal(DocumentInput.create(123, 'protocol').number, 123);
  assert.equal(DocumentInput.fromRoute('00123', 'protocol').number, 123);
  assert.equal(DirectoryInput.create('  files  ').path, 'files');
  assert.equal(DocumentInput.create(123, 'protocol').kind, 'protocol');
  assert.equal(DocumentInput.create(123, 'certificate').kind, 'certificate');
  assert.throws(() => DocumentInput.create(123, 'other'), InvalidInputError);
  assert.throws(() => FilesInput.create(DirectoryInput.create('files'), ['a\0b']), InvalidInputError);
  assert.throws(() => FilesInput.create(DirectoryInput.create('files'), new Array(1)), InvalidInputError);
});
