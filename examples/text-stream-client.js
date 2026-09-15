// Copy into a frontend that uses a bundler. Install `docx` there to export Word.
export async function extractText(url, { onPage, signal } = {}) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Falha na extração: HTTP ${response.status}`);
  if (!response.body) throw new Error('Streaming indisponível.');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  let completed = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'page') await onPage?.(event);
        if (event.type === 'done') completed = true;
      }
    }
    if (!completed || pending.trim()) throw new Error('A conexão terminou antes de concluir a extração.');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Use the received pages to create Word without running OCR a second time.
export async function createWord(pages) {
  const { Document, HeadingLevel, Packer, Paragraph } = await import('docx');
  const children = [];
  let previousFile;
  for (const page of pages) {
    if (page.file !== previousFile) {
      children.push(new Paragraph({ text: page.file, heading: HeadingLevel.HEADING_1, pageBreakBefore: children.length > 0 }));
      previousFile = page.file;
    }
    children.push(new Paragraph({ text: `Página ${page.page}`, heading: HeadingLevel.HEADING_2 }));
    for (const text of (page.text || '[Nenhum texto reconhecido nesta página.]').split(/\r?\n/)) {
      children.push(new Paragraph({ text }));
    }
  }
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}
