import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { PdfConversionUseCase } from '../src/app/usecase/pdf.conversion.usecase.js';
import type { ConversionWorkspaceGateway } from '../src/app/contracts/conversion.workspace.gateway.js';
import type { DocumentUploadGateway } from '../src/app/contracts/document.upload.gateway.js';
import type { PdfConversionGateway } from '../src/app/contracts/pdf.conversion.gateway.js';
import { PdfConversionError } from '../src/app/errors/pdf.conversion.error.js';

function setup(failure?: string) {
  const calls: string[] = [];
  let monitorError!: (error: unknown) => void;
  const step = (name: string) => { calls.push(name); if (failure === name) throw new Error(name); };
  const workspace: ConversionWorkspaceGateway = {
    async create() { step('create'); return 'workspace'; },
    async checkSpace() {},
    watch(_directory, onError) { step('watch'); monitorError = onError; return () => { step('stop'); }; },
    async openOutput() { step('open'); return { size: 3, stream: Readable.from(['pdf']) }; },
    async remove(directory) { assert.equal(directory, 'workspace'); step('remove'); },
  };
  const upload: DocumentUploadGateway = { async receive() { step('upload'); return 150; } };
  const converter: PdfConversionGateway = {
    async check() { step('check'); },
    async convert(directory, count) {
      assert.equal(directory, 'workspace'); assert.equal(count, 150);
      step('convert'); return 'result.pdf';
    },
  };
  const usecase = new PdfConversionUseCase(upload, converter, workspace, 1);
  const input = { stream: Readable.from([]), headers: { 'content-type': 'multipart/form-data; boundary=test' } };
  return { usecase, input, calls, upload, workspace, failMonitor: (error: unknown) => monitorError(error) };
}

test('use case owns cleanup and admission until the output consumer completes', async () => {
  const { usecase, input, calls } = setup();
  await usecase.execute(input, async output => {
    assert.equal(output.size, 3);
    assert.ok(!calls.includes('remove'));
    await assert.rejects(usecase.execute(input, async () => {}, new AbortController().signal),
      error => error instanceof PdfConversionError && error.status === 503 && error.retryAfter === 10);
    for await (const _chunk of output.stream) { /* consume output */ }
  }, new AbortController().signal);
  assert.deepEqual(calls, ['check', 'create', 'watch', 'upload', 'convert', 'open', 'stop', 'remove']);
  await usecase.execute(input, async () => {}, new AbortController().signal);
});

test('failures release the slot and remove only an allocated workspace', async () => {
  for (const stage of ['check', 'create', 'watch', 'upload', 'convert', 'open', 'remove']) {
    const { usecase, input, calls } = setup(stage);
    for (let attempt = 0; attempt < 2; attempt++) {
      await assert.rejects(usecase.execute(input, async () => {}, new AbortController().signal), new RegExp(stage));
    }
    assert.equal(calls.filter(call => call === 'check').length, 2);
    assert.equal(calls.includes('remove'), stage !== 'check' && stage !== 'create');
  }
});

test('consumer failure still destroys the output and removes temporary files', async () => {
  const { usecase, input, calls } = setup();
  let outputStream: Readable | undefined;
  await assert.rejects(usecase.execute(input, async output => {
    outputStream = output.stream;
    throw new Error('download failed');
  }, new AbortController().signal), /download failed/);
  assert.equal(outputStream?.destroyed, true);
  assert.deepEqual(calls.slice(-2), ['stop', 'remove']);
});

test('client cancellation and disk monitor failure propagate to the consumer', async () => {
  for (const source of ['client', 'disk']) {
    const { usecase, input, calls, failMonitor } = setup();
    const controller = new AbortController();
    const reason = new Error(source);
    await assert.rejects(usecase.execute(input, async (_output, signal) => {
      if (source === 'client') controller.abort(reason);
      else failMonitor(reason);
      assert.equal(signal.reason, reason);
      signal.throwIfAborted();
    }, controller.signal), reason);
    assert.deepEqual(calls.slice(-2), ['stop', 'remove']);
  }
});

test('application rejects unsupported media before accessing any gateway', async () => {
  const { usecase, input, calls } = setup();
  for (const contentType of [undefined, '', 'application/json', 'multipart/form-data-invalid', ['multipart/form-data']]) {
    await assert.rejects(usecase.execute(
      { ...input, headers: { 'content-type': contentType } }, async () => {}, new AbortController().signal,
    ), error => error instanceof PdfConversionError && error.status === 415);
  }
  assert.deepEqual(calls, []);
  await usecase.execute({ ...input, headers: { 'content-type': 'Multipart/Form-Data; boundary="test"' } },
    async () => {}, new AbortController().signal);
});

test('application rejects an empty upload before conversion and cleans the workspace', async () => {
  const { usecase, input, calls, upload } = setup();
  upload.receive = async () => 0;
  await assert.rejects(usecase.execute(input, async () => { assert.fail('Must not deliver a PDF'); },
    new AbortController().signal), error => error instanceof PdfConversionError && error.status === 400);
  assert.ok(!calls.includes('convert'));
  assert.deepEqual(calls.slice(-2), ['stop', 'remove']);
});

test('application rejects an empty output before delivery and closes its stream', async () => {
  const { usecase, input, calls, workspace } = setup();
  const stream = Readable.from([]);
  workspace.openOutput = async () => ({ size: 0, stream });
  await assert.rejects(usecase.execute(input, async () => { assert.fail('Must not deliver an empty PDF'); },
    new AbortController().signal), error => error instanceof PdfConversionError && error.status === 422);
  assert.equal(stream.destroyed, true);
  assert.deepEqual(calls.slice(-2), ['stop', 'remove']);
});

test('use case checks disk space from upload progress at each 8 MiB interval', async () => {
  const { usecase, input, upload, workspace } = setup();
  let diskChecks = 0;
  workspace.checkSpace = async directory => {
    assert.equal(directory, 'workspace');
    diskChecks++;
  };
  upload.receive = async (_input, _directory, _signal, onProgress) => {
    await onProgress(1024);
    assert.equal(diskChecks, 0);
    await onProgress(8 * 1024 * 1024);
    assert.equal(diskChecks, 1);
    await onProgress(9 * 1024 * 1024);
    assert.equal(diskChecks, 1);
    await onProgress(16 * 1024 * 1024);
    assert.equal(diskChecks, 2);
    return 150;
  };
  await usecase.execute(input, async () => {}, new AbortController().signal);
});

test('failed upload disk check prevents conversion and releases resources and slot', async () => {
  const { usecase, input, upload, workspace, calls } = setup();
  const diskError = new PdfConversionError(507, 'Disco cheio.');
  workspace.checkSpace = async () => { throw diskError; };
  upload.receive = async (_input, _directory, _signal, onProgress) => {
    await onProgress(8 * 1024 * 1024);
    return 150;
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(usecase.execute(input, async () => {}, new AbortController().signal), diskError);
  }
  assert.ok(!calls.includes('convert'));
  assert.equal(calls.filter(call => call === 'remove').length, 2);
});
