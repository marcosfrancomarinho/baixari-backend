import { DirectoryInput } from '../src/app/input/directory.input.js';
import { FilesInput } from '../src/app/input/files.input.js';
import { FsFileSystemGateway } from '../src/infra/fs.file.system.gateway.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { LocalTextExtractionServices } from '../src/infra/local.text.extraction.services.js';
import { TextExtractionError } from '../src/app/contracts/text.extraction.services.js';

test('Text extraction reads native PDF, PNG, JPEG, scanned and mixed PDF pages locally', { timeout: 120000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'baixari-word-'));
  try {
    const canvas = createCanvas(1400, 240);
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, 1400, 240);
    context.fillStyle = 'black';
    context.font = '56px Arial';
    context.fillText('DOCUMENTO TESTE 12345', 60, 130);
    const png = canvas.toBuffer('image/png');
    await writeFile(join(root, '2.png'), png);
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', '3.JPEG'), canvas.toBuffer('image/jpeg'));
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText('Texto original do PDF 67890');
    const embedded = await pdf.embedPng(png);
    pdf.addPage([700, 120]).drawImage(embedded, { x: 0, y: 0, width: 700, height: 120 });
    const mixed = pdf.addPage([700, 240]);
    mixed.drawText('CABECALHO', { x: 30, y: 200, size: 24 });
    mixed.drawImage(embedded, { x: 0, y: 0, width: 700, height: 120 });
    pdf.addPage();
    await writeFile(join(root, '1.pdf'), await pdf.save());
    const pages = [];
    for await (const page of new LocalTextExtractionServices().extract(FilesInput.create(DirectoryInput.create(root), await new FsFileSystemGateway(root, root).listFiles(DirectoryInput.create(root))))) pages.push(page);
    assert.equal(pages.length, 6);
    assert.match(pages[0].text, /Texto original do PDF 67890/);
    assert.equal(pages.filter(page => page.text.includes('DOCUMENTO TESTE 12345')).length, 4);
    assert.match(pages[2].text, /CABECALHO/);
    assert.equal(pages[3].text, '');
    assert.equal(pages[0].file, '1.pdf');
    assert.equal(pages[4].file, '2.png');
    await writeFile(join(root, '0.pdf'), 'invalid pdf');
    await assert.rejects(new LocalTextExtractionServices().extract(FilesInput.create(DirectoryInput.create(root), await new FsFileSystemGateway(root, root).listFiles(DirectoryInput.create(root)))).next(), TextExtractionError);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'baixari-word-')));
    await rm(root, { recursive: true, force: true });
  }
});
