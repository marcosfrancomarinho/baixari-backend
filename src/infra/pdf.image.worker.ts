// Programa CommonJS independente: o mesmo codigo funciona nos bundles de desenvolvimento e producao.
export const imageWorker = String.raw`
const { open, writeFile, appendFile, unlink } = require('node:fs/promises');
const { join } = require('node:path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const A4_WIDTH_POINTS = 595.28;
const A4_HEIGHT_POINTS = 841.89;
const JPEG_QUALITY = 90;

sharp.cache(false);
sharp.concurrency(1);

function readArguments() {
  const [directory, documentCount, maxImagePixels, maxImageSide] = process.argv.slice(1);
  return {
    directory,
    documentCount: Number(documentCount),
    maxImagePixels: Number(maxImagePixels),
    maxImageSide: Number(maxImageSide),
  };
}

async function identifyDocument(inputPath) {
  const file = await open(inputPath, 'r');
  const signature = Buffer.alloc(8);
  try {
    await file.read(signature, 0, signature.length, 0);
  } finally {
    await file.close();
  }

  if (signature.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (signature.equals(PNG_SIGNATURE)) return 'image';

  const isJpeg = signature[0] === 255 && signature[1] === 216 && signature[2] === 255;
  if (isJpeg) return 'image';

  throw new Error('UNSUPPORTED');
}

async function prepareImage(inputPath, config) {
  const imageOptions = {
    limitInputPixels: config.maxImagePixels,
    sequentialRead: true,
    failOn: 'warning',
  };
  const metadata = await sharp(inputPath, imageOptions).metadata();
  if ((metadata.pages || 1) > 1) {
    throw new Error('ANIMATED');
  }

  return sharp(inputPath, imageOptions)
    .rotate()
    .resize({
      width: config.maxImageSide,
      height: config.maxImageSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
}

async function writeImagePdf(inputPath, outputPath, config) {
  const jpegBytes = await prepareImage(inputPath, config);
  const document = await PDFDocument.create();
  const image = await document.embedJpg(jpegBytes);
  const scale = Math.min(A4_WIDTH_POINTS / image.width, A4_HEIGHT_POINTS / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;

  const page = document.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  await writeFile(outputPath, await document.save());
}

async function prepareDocument(index, config) {
  const uploadFilename = index + '.upload';
  const inputPath = join(config.directory, uploadFilename);
  const documentType = await identifyDocument(inputPath);
  if (documentType === 'pdf') return uploadFilename;

  const pdfFilename = index + '.pdf';
  await writeImagePdf(inputPath, join(config.directory, pdfFilename), config);
  await unlink(inputPath);
  return pdfFilename;
}

async function main() {
  const config = readArguments();
  const manifestPath = join(config.directory, 'inputs.txt');

  // Processa um documento por vez para nao acumular imagens decodificadas em memoria.
  for (let index = 0; index < config.documentCount; index++) {
    const filename = await prepareDocument(index, config);
    // O manifesto recebe apenas nomes numericos internos, nunca nomes do cliente.
    await appendFile(manifestPath, filename + '\n');
  }
}

main().catch(() => {
  process.exitCode = 2;
});
`;
