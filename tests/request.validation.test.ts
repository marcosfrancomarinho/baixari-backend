import assert from 'node:assert/strict';
import { join } from 'node:path';
import { test } from 'node:test';
import { DocumentNotFoundError } from '../src/app/errors/document.not-found.error.js';
import { DocumentRequest } from '../src/app/request/document.request.js';
import { RequestValidationError } from '../src/app/request/request.validation.error.js';

test('DocumentRequest is the single validation boundary for HTTP values', () => {
  for (const number of ['123abc', '1.5', '1e2', '0x10', '-1', '0', '', ' 1 ', null, undefined, ['1']]) {
    assert.throws(
      () => DocumentRequest.forText({ number, kind: 'protocol' }),
      RequestValidationError,
    );
  }

  for (const number of [NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => DocumentRequest.forText({ number, kind: 'protocol' }),
      RequestValidationError,
    );
  }

  assert.throws(
    () => DocumentRequest.forText({ number: '123', kind: 'other' }),
    RequestValidationError,
  );

  for (const format of ['', 'docx', 'rar', ['pdf', 'zip']]) {
    assert.throws(
      () => DocumentRequest.forDownload({ number: '123', kind: 'protocol', format }),
      RequestValidationError,
    );
  }
});

test('DocumentRequest preserves normalized and immutable data', () => {
  const download = DocumentRequest.forDownload({
    number: '00123',
    kind: 'certificate',
    format: undefined,
  });
  const text = DocumentRequest.forText({ number: 123, kind: 'protocol' });

  assert.equal(download.number, 123);
  assert.equal(download.kind, 'certificate');
  assert.equal(download.format, 'zip');
  assert.equal(download.resolveDirectory(' files '), join('files', '123'));
  assert.equal(text.format, 'text');
  assert.ok(Object.isFrozen(download));
  assert.ok(Object.isFrozen(text));
});

test('DocumentRequest validates and selects files once for each operation', () => {
  const zip = DocumentRequest.forDownload({ number: 123, kind: 'protocol', format: 'zip' });
  const pdf = DocumentRequest.forDownload({ number: 123, kind: 'protocol', format: 'pdf' });
  const text = DocumentRequest.forText({ number: 123, kind: 'protocol' });
  const source = ['2.PDF', 'notes.txt', 'nested/3.PNG'];

  assert.deepEqual(zip.selectFiles(source), source);
  assert.deepEqual(pdf.selectFiles(source), ['2.PDF', 'nested/3.PNG']);
  assert.deepEqual(text.selectFiles(source), ['2.PDF', 'nested/3.PNG']);
  assert.ok(Object.isFrozen(pdf.selectFiles(source)));
  assert.throws(() => zip.resolveDirectory(' '), RequestValidationError);
  assert.throws(() => zip.selectFiles('not-an-array'), RequestValidationError);
  assert.throws(() => zip.selectFiles(['a\0b']), RequestValidationError);
  assert.throws(() => zip.selectFiles([]), DocumentNotFoundError);
  assert.throws(() => pdf.selectFiles(['notes.txt']), DocumentNotFoundError);
});
