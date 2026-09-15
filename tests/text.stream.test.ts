import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { setTimeout as pause } from 'node:timers/promises';
import { TextExtractionController } from '../src/presentation/controllers/text.extraction.controller.js';
import { Path } from '../src/domain/valuesobject/path.js';
import type { WordServices } from '../src/domain/gateway/word.services.js';
import { extractText, createWord } from '../examples/text-stream-client.js';
import JSZip from 'jszip';

test('HTTP sends pages before extraction finishes, reports errors and stops after disconnect', async () => {
  let released = false;
  let stopped = false;
  let mode = 'normal';
  const services: WordServices = {
    async generate() { throw new Error('Not used'); },
    async *extract(_path, signal) {
      try {
        yield { file: 'ação.pdf', page: 1, totalPages: 2, text: 'Primeira página' };
        if (mode === 'error') throw new Error('PDF ilegível');
        while (!released) await pause(10, undefined, { signal });
        yield { file: 'ação.pdf', page: 2, totalPages: 2, text: 'Segunda página' };
      } finally { stopped = true; }
    },
  };
  const checker = { async checkProtocol() { return Path.create('test'); }, async checkCertificate() { return Path.create('test'); } };
  const controller = new TextExtractionController(checker, services);
  const app = express();
  app.get('/:kind/:number/text', (req, res) => controller.execute(req, res, req.params.kind as 'protocol' | 'certificate'));
  const server = app.listen(0, '127.0.0.1');
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const kind of ['protocol', 'certificate']) {
      released = false;
      const pages: any[] = [];
      await extractText(`${base}/${kind}/1/text`, { onPage(page: any) {
        if (page.page === 1) { assert.equal(released, false); released = true; }
        pages.push(page);
      } });
      assert.equal(pages.length, 2);
      assert.equal(pages[0].file, 'ação.pdf');
      const blob = await createWord(pages);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      assert.match(await zip.file('word/document.xml')!.async('string'), /Segunda página/);
    }
    mode = 'error';
    await assert.rejects(extractText(`${base}/protocol/1/text`), /PDF ilegível/);
    mode = 'normal';
    released = false;
    stopped = false;
    const cancel = new AbortController();
    await assert.rejects(extractText(`${base}/protocol/1/text`, { signal: cancel.signal, onPage() { cancel.abort(); } }));
    for (let i = 0; i < 100 && !stopped; i++) await pause(10);
    assert.equal(stopped, true);
    assert.equal((await fetch(`${base}/protocol/no/text`)).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
