import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import express from 'express';
import { PDFDocument } from 'pdf-lib';
import { PdfConversionController } from '../src/presentation/controllers/pdf.conversion.controller.js';
import { conversionConfig, type ConversionConfig } from '../src/infra/pdf.conversion.config.js';
import type { PdfConversionGateway as PdfConverter } from '../src/app/contracts/pdf.conversion.gateway.js';
import { DiskPdfConversion } from '../src/infra/disk.pdf.conversion.js';
import { DiskDocumentUpload } from '../src/infra/disk.document.upload.js';
import { FsConversionWorkspaceGateway } from '../src/infra/fs.conversion.workspace.gateway.js';
import { PdfConversionUseCase } from '../src/app/usecase/pdf.conversion.usecase.js';
import { imageWorker } from '../src/infra/pdf.image.worker.js';

async function pdf(width = 200) {
  const document = await PDFDocument.create();
  document.addPage([width, 300]);
  return Buffer.from(await document.save());
}

function form(files: Buffer[], field = 'files') {
  const body = new FormData();
  files.forEach(file => body.append(field, new Blob([new Uint8Array(file)]), '../../ignored.exe'));
  return body;
}

async function serve(converter?: PdfConverter, overrides: Partial<ConversionConfig> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'baixari-conversion-test-'));
  const config = { ...conversionConfig(), tempRoot: root, minFreeBytes: 1, ...overrides };
  const workspace = new FsConversionWorkspaceGateway(config);
  const controller = new PdfConversionController(new PdfConversionUseCase(
    new DiskDocumentUpload(config), converter ?? new DiskPdfConversion(config), workspace, config.maxConcurrent,
  ));
  const app = express();
  app.post('/documents/convert/pdf', (req, res) => controller.execute(req, res));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return {
    root, url: `http://127.0.0.1:${address.port}/documents/convert/pdf`,
    async close() {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      // HTTP finish precedes the controller's asynchronous finally cleanup.
      for (let i = 0; i < 200 && (await readdir(root)).length; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.deepEqual(await readdir(root), [], 'temporary files must be removed');
      await rm(root, { recursive: true, force: true });
    },
  };
}

const fake: PdfConverter = {
  async check() {},
  async convert(directory, count) {
    assert.ok(count > 0);
    const output = join(directory, 'result.pdf');
    await writeFile(output, await pdf());
    return output;
  },
};

test('upload streams arbitrary file counts to disk, preserves order and cleans up', async () => {
  const app = await serve({ ...fake, async convert(directory, count) {
    assert.equal(count, 125);
    for (let i = 0; i < count; i++) {
      assert.equal((await readFile(join(directory, `${i}.upload`))).toString(), String(i));
    }
    return fake.convert(directory, count, new AbortController().signal);
  } });
  try {
    const response = await fetch(app.url, { method: 'POST', body: form(Array.from({ length: 125 }, (_, i) => Buffer.from(String(i)))) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition')!, /documentos.pdf/);
    assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(), 1);
  } finally { await app.close(); }
});

test('invalid multipart, wrong fields, missing documents and oversized files are rejected', async () => {
  const app = await serve(fake, { maxFileBytes: 32 });
  try {
    for (const [body, status] of [
      [form([Buffer.alloc(33)]), 413], [form([Buffer.from('x')], 'other'), 400],
      [new FormData(), 400], ['text', 415],
    ] as const) {
      assert.equal((await fetch(app.url, { method: 'POST', body })).status, status);
      // Wait for the slot to be released after response and cleanup.
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    assert.equal((await fetch(app.url, {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=bad' }, body: '--bad\r\ninvalid',
    })).status, 400);
  } finally { await app.close(); }
});

test('disk reserve is enforced before writing uploads', async () => {
  const app = await serve(fake, { minFreeBytes: Number.MAX_SAFE_INTEGER });
  try {
    assert.equal((await fetch(app.url, { method: 'POST', body: form([Buffer.from('x')]) })).status, 507);
  } finally { await app.close(); }
});

test('busy requests fail fast; disconnect cancels conversion and releases the slot', async () => {
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  let cancelled = false;
  const app = await serve({ ...fake, async convert(_dir, _count, signal) {
    started();
    await new Promise<void>((_resolve, reject) => {
      signal.addEventListener('abort', () => { cancelled = true; reject(signal.reason); }, { once: true });
    });
    throw new Error('unreachable');
  } });
  const abort = new AbortController();
  try {
    const first = fetch(app.url, { method: 'POST', body: form([Buffer.from('x')]), signal: abort.signal }).catch(() => {});
    await ready;
    const busy = await fetch(app.url, { method: 'POST', body: form([Buffer.from('x')]) });
    assert.equal(busy.status, 503);
    assert.equal(busy.headers.get('retry-after'), '10');
    abort.abort();
    await first;
    for (let i = 0; i < 100 && !cancelled; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(cancelled, true);
  } finally { await app.close(); }
});

test('idle uploads terminate with 408 and remove partial files', async () => {
  const app = await serve(fake, { uploadIdleMs: 60 });
  try {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = httpRequest(app.url, { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' } }, response => {
        response.resume();
        response.once('end', () => { resolve(response.statusCode); req.destroy(); });
      });
      req.on('error', reject);
      req.write('--test\r\nContent-Disposition: form-data; name="files"; filename="a.pdf"\r\n\r\npartial');
    });
    assert.equal(status, 408);
  } finally { await app.close(); }
});

test('image worker detects content, writes ordered disk manifest and rejects invalid data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baixari-worker-test-'));
  const run = () => new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', imageWorker, root, '3', '40000000', '3000'], { windowsHide: true });
    child.once('error', reject);
    child.once('close', resolve);
  });
  try {
    await writeFile(join(root, '0.upload'), await pdf());
    await writeFile(join(root, '1.upload'), await readFile(new URL('./fixtures/image.png', import.meta.url)));
    await writeFile(join(root, '2.upload'), await readFile(new URL('./fixtures/image.jpg', import.meta.url)));
    assert.equal(await run(), 0);
    assert.equal(await readFile(join(root, 'inputs.txt'), 'utf8'), '0.upload\n1.pdf\n2.pdf\n');
    for (const name of ['1.pdf', '2.pdf']) {
      assert.equal((await PDFDocument.load(await readFile(join(root, name)))).getPageCount(), 1);
    }
    await writeFile(join(root, '0.upload'), 'not an image');
    assert.equal(await run(), 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('missing Ghostscript returns a clear 503 without accepting upload', async () => {
  const app = await serve(undefined, { ghostscript: resolve('missing-ghostscript-executable') });
  try {
    const response = await fetch(app.url, { method: 'POST', body: form([await pdf()]) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /GHOSTSCRIPT_PATH/);
  } finally { await app.close(); }
});

test('real Ghostscript combines PDFs and images in upload order', { skip: !process.env.GHOSTSCRIPT_PATH }, async () => {
  const app = await serve();
  try {
    const response = await fetch(app.url, { method: 'POST', body: form([
      await pdf(210), await readFile(new URL('./fixtures/image.png', import.meta.url)),
      await pdf(420), await readFile(new URL('./fixtures/image.jpg', import.meta.url)),
    ]) });
    assert.equal(response.status, 200, await (response.status !== 200 ? response.text() : Promise.resolve('')));
    const document = await PDFDocument.load(await response.arrayBuffer());
    assert.equal(document.getPageCount(), 4);
    assert.equal(document.getPage(0).getWidth(), 210);
    assert.equal(document.getPage(2).getWidth(), 420);
  } finally { await app.close(); }
});

test('real conversion accepts more than 100 images and rejects corrupt documents', { skip: !process.env.GHOSTSCRIPT_PATH }, async () => {
  const app = await serve();
  try {
    const image = await readFile(new URL('./fixtures/image.png', import.meta.url));
    const response = await fetch(app.url, { method: 'POST', body: form(Array.from({ length: 150 }, () => image)) });
    assert.equal(response.status, 200);
    assert.equal((await PDFDocument.load(await response.arrayBuffer())).getPageCount(), 150);
    await new Promise(resolve => setTimeout(resolve, 100));
    for (const bytes of [Buffer.from('%PDF-1.7\ncorrupt'), Buffer.from('not an image')]) {
      assert.equal((await fetch(app.url, { method: 'POST', body: form([bytes]) })).status, 422);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } finally { await app.close(); }
});
