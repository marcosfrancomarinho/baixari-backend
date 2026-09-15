# 🗜️ Baixari Backend

Backend em **Node.js + TypeScript** responsável por localizar arquivos, validar sua existência e preparar downloads compactados em ZIP.

## ✨ Principais pontos

- API HTTP com Express
- Fluxo compartilhado para protocolos e certidões
- Verificação de existência de arquivos
- Compactação com Archiver
- Organização em aplicação, infraestrutura e apresentação
- Build com esbuild

## 🛠️ Tecnologias

- Node.js
- TypeScript
- Express 5
- Archiver
- CORS
- esbuild
- TSX

## 🏗️ Estrutura

```text
src/
├── app/
│   ├── contracts/
│   ├── errors/
│   ├── factory/
│   ├── model/
│   ├── request/
│   ├── services/
│   ├── strategy/
│   └── usecase/
├── di/
├── infra/
├── presentation/
│   ├── controllers/
│   ├── http/
│   └── routers/
└── main.ts
```

`DocumentRequest` é a única fronteira de validação. Ele recebe os valores brutos
da requisição HTTP, valida número, tipo e formato, resolve o diretório e seleciona
os arquivos compatíveis com ZIP, PDF ou texto. O controller apenas cria esse
objeto e chama o caso de uso; o caso de uso não repete a validação.

O objeto possui construtor privado, fábricas `forDownload()` e `forText()` e dados
imutáveis. Entradas inválidas retornam HTTP 400. Pastas ou arquivos compatíveis
inexistentes retornam HTTP 404. Falhas inesperadas retornam HTTP 500.

`DocumentFilesFinder` concentra a consulta ao sistema de arquivos. O mesmo
`FileDownloaderUseCase` atende protocolos e certidões, e as strategies continuam
responsáveis pela geração de ZIP ou PDF.

## ▶️ Desenvolvimento

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Produção:

```bash
npm start
```

## 🎯 Objetivo

Centralizar as regras de localização, validação e compactação de arquivos em uma API separada do frontend.

## 👨‍💻 Autor

Marcos Marinho

## Download ZIP ou PDF

O cliente escolhe o formato pelo parametro `format` na query string:

```http
GET /protocol/123?format=pdf
GET /protocol/123?format=zip
GET /certificate/123?format=pdf
GET /certificate/123?format=zip
```

Sem `format`, o retorno continua sendo ZIP. Outros valores retornam HTTP 400.

O formato PDF une PDFs e imagens JPG, JPEG e PNG em um unico PDF, percorrendo
a pasta e subpastas em ordem de nome (ordenacao numerica). Cada imagem ocupa
uma pagina com suas proporcoes originais. Pastas contendo apenas imagens tambem
sao aceitas. Quando ha apenas um PDF e nenhuma imagem, retorna o PDF original.
Arquivos de outros formatos sao ignorados.
Uma pasta sem PDFs ou imagens suportadas retorna HTTP 404. A uniao e feita em memoria; o PDF unido
nao preserva as assinaturas digitais dos arquivos originais.

Testes: `node --import tsx --test tests/download.test.ts`.

## Texto progressivo para o frontend

```http
GET /protocol/123/text
GET /certificate/123/text
```

A resposta usa `application/x-ndjson`: um objeto JSON por linha, enviado assim
que a página termina. Não use `response.json()` ou `response.text()` no cliente,
pois ambos esperam a resposta inteira. Exemplo dos eventos:

```json
{"type":"start"}
{"type":"page","file":"documento.pdf","page":1,"totalPages":2,"text":"Texto da primeira página"}
{"type":"page","file":"documento.pdf","page":2,"totalPages":2,"text":"Texto da segunda página"}
{"type":"done","pages":2}
```

`totalPages` corresponde ao arquivo atual. Uma imagem tem uma página. Uma página
sem texto reconhecido envia `text: ""`. Depois de iniciar a resposta, uma falha
envia `{"type":"error","error":"..."}` e encerra a conexão sem `done`.
Pasta inexistente retorna HTTP 404; número inválido retorna HTTP 400 antes de iniciar.
Pasta vazia ou sem formatos suportados retorna HTTP 404 antes de `start`.
ZIP aceita qualquer arquivo; PDF e texto aceitam PDF, JPG, JPEG e PNG.

O backend processa uma página por vez por requisição e aguarda o escoamento da
resposta quando o cliente está lento. As páginas concluídas não ficam acumuladas
no servidor. PDFs são abertos pelo caminho local com leitura por intervalos,
evitando a cópia integral explícita feita anteriormente. O leitor de PDF ainda
pode manter estruturas do documento na memória, e imagens precisam ser decodificadas
antes da redução: isso não é um limite absoluto de RAM ou CPU.

Ao cancelar a conexão, o processamento para antes da próxima página e libera os
recursos. Se um OCR já estiver em execução, ele termina a página atual antes de
encerrar. Requisições simultâneas ainda executam separadamente.

### Exemplo de integração e Word no navegador

Copie `examples/text-stream-client.js` para seu frontend e instale `docx` nele.
O exemplo trata caracteres UTF-8 e linhas divididas entre pacotes de rede.

```js
import { extractText, createWord } from './text-stream-client.js';

const controller = new AbortController();
const pages = [];
await extractText('http://localhost:3000/protocol/123/text', {
  signal: controller.signal,
  onPage(page) {
    pages.push(page);
    // Atualize a interface com page.text, page.file e page.page.
    // Ao inserir texto no DOM, use textContent.
  },
});

// Execute somente após a conclusão bem-sucedida; não repete o OCR.
const blob = await createWord(pages);
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = 'protocolo_123.docx';
link.click();
setTimeout(() => URL.revokeObjectURL(url), 60000);

// No botão Cancelar, durante a extração: controller.abort().
```

O navegador guarda o texto e monta o Word ao final. O download direto com
`?format=docx` foi removido e retorna HTTP 400. ZIP e PDF continuam disponíveis.
Este repositório contém o backend e um exemplo de integração para o frontend.
A dependência `docx` fica em devDependencies para testar esse exemplo; o backend
não gera Word.

### Organização

- `DocumentRequest`: validação única dos valores recebidos e seleção dos arquivos.
- `DocumentFilesFinder`: localização do diretório e leitura dos arquivos.
- `FileDownloaderController`: resposta HTTP compartilhada por protocolo e certidão.
- `FileDownloaderUseCase`: coordenação dos downloads ZIP e PDF.
- `TextExtractionController`: resposta HTTP, eventos NDJSON e desconexão.
- `TextExtractionUseCase`: coordenação da extração progressiva.
- `TextExtractionServices`: contrato de extração de páginas.
- `LocalTextExtractionServices`: leitura de PDF e OCR local em português.
- As strategies de download permanecem responsáveis por ZIP e PDF.

O OCR usa imagens de até 4 milhões de pixels e escala máxima 2 para PDFs,
com pausa de 100 ms entre páginas. Os modelos são instalados nas dependências;
os documentos não são enviados para serviços externos. Requer Node.js 22.13+.
A precisão depende da legibilidade; revise o texto reconhecido.

Validação:

```bash
node --import tsx --test tests/*.test.ts
npm run build
```

Se houver proxy, desative o buffering dessa resposta e configure um timeout que
suporte a leitura de uma página lenta. A API envia `X-Accel-Buffering: no` e
`Cache-Control: no-store, no-transform`.

Referências: [streaming no Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#streaming_the_response_body)
e [controle de fluxo no Node HTTP](https://nodejs.org/api/http.html#responsewritechunk-encoding-callback).
