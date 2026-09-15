import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { LocalWordServices } from '../src/infra/local.word.services.js';
import { Path } from '../src/domain/valuesobject/path.js';
import { WordGenerationError } from '../src/domain/gateway/word.services.js';

test('Word extracts native PDF, PNG, JPEG, scanned and mixed PDF pages locally', { timeout: 120000 }, async () => {
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
    const stream = await new LocalWordServices().generate(Path.create(root));
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const zip = await JSZip.loadAsync(Buffer.concat(chunks));
    const xml = await zip.file('word/document.xml')!.async('string');
    assert.match(xml, /Texto original do PDF 67890/);
    assert.equal((xml.match(/DOCUMENTO TESTE 12345/g) || []).length, 4);
    assert.match(xml, /CABECALHO/);
    assert.match(xml, /Nenhum texto reconhecido/);
    assert.ok(xml.indexOf('1.pdf') < xml.indexOf('2.png'));
    await writeFile(join(root, '0.pdf'), 'invalid pdf');
    await assert.rejects(new LocalWordServices().generate(Path.create(root)), WordGenerationError);
  } finally {
    assert.ok(root.startsWith(join(tmpdir(), 'baixari-word-')));
    await rm(root, { recursive: true, force: true });
  }
});
