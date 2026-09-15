# 🗜️ Baixari Backend

Backend em **Node.js + TypeScript** responsável por localizar arquivos, validar sua existência e preparar downloads compactados em ZIP.

## ✨ Principais pontos

- API HTTP com Express
- Casos de uso separados para protocolos e certidões
- Verificação de existência de arquivos
- Compactação com Archiver
- Organização em domínio, aplicação, infraestrutura e apresentação
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
│   ├── dto/
│   └── usecase/
├── domain/
│   ├── entities/
│   ├── gateway/
│   └── valuesobject/
├── infra/
├── presentation/
│   ├── controllers/
│   └── routers/
└── main.ts
```

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
Nos casos de uso, o input aceita `{ number: 123, format: 'pdf' }`.

O formato PDF une PDFs e imagens JPG, JPEG e PNG em um unico PDF, percorrendo
a pasta e subpastas em ordem de nome (ordenacao numerica). Cada imagem ocupa
uma pagina com suas proporcoes originais. Pastas contendo apenas imagens tambem
sao aceitas. Quando ha apenas um PDF e nenhuma imagem, retorna o PDF original.
Arquivos de outros formatos sao ignorados.
Uma pasta sem PDFs ou imagens suportadas retorna HTTP 404. A uniao e feita em memoria; o PDF unido
nao preserva as assinaturas digitais dos arquivos originais.

Testes: `node --import tsx --test tests/download.test.ts`.

## Download em Word com extração de texto

```http
GET /protocol/123?format=docx
GET /certificate/123?format=docx
```

Gera um arquivo Word `.docx` editável com o texto dos PDFs e imagens JPG,
JPEG e PNG já presentes na pasta do protocolo ou da certidão, incluindo subpastas.
Não é necessário enviar os arquivos novamente. Sem `format`, o retorno continua ZIP.

- PDFs com texto selecionável: extração direta do texto.
- Imagens, páginas escaneadas e páginas de PDF contendo imagens: OCR local em
  português com Tesseract. Em páginas mistas, a página inteira passa pelo OCR.
- O Word identifica o arquivo de origem e a página, seguindo a ordem numérica dos
  nomes. O conteúdo vira texto editável; tabelas, imagens e layout não são reproduzidos.
- Páginas sem texto reconhecido recebem uma indicação no Word. A precisão do OCR
  depende da resolução, orientação e legibilidade; revise o texto reconhecido.
- Os documentos são processados no servidor, sem envio a serviços externos.
  O modelo de português é instalado com as dependências; o OCR não exige download
  em tempo de execução nem chave de API.
- Pasta ausente ou sem arquivos suportados: HTTP 404. Falha de processamento,
  arquivo corrompido ou PDF protegido por senha: HTTP 500, sem Word parcial.

Requer Node.js 22.13 ou superior. Execute `yarn install` após atualizar.
O processamento acontece durante a requisição
e pode demorar em documentos grandes; considere esse tempo no timeout do cliente
e do proxy. Cada requisição usa seu próprio worker de OCR e o encerra ao terminar.
No download direto, o Word é montado em memória. O OCR usa imagens de até
4 milhões de pixels; PDFs são renderizados em escala máxima 2 (aproximadamente
144 DPI em páginas convencionais). Existe uma pausa de 100 ms entre páginas.
Não há fila de processamento nesta versão.

Testes de download e extração (incluem OCR real, sem acesso à internet):

```bash
node --import tsx --test tests/download.test.ts tests/word.test.ts tests/text.stream.test.ts
npm run build
```

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
Pasta vazia é informada por um evento `error` depois de `start`.

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

Nesse fluxo, o navegador guarda o texto e monta o Word no final. A rota antiga
`?format=docx` continua disponível para download direto, mas chamá-la depois de
`/text` executaria a extração novamente. Este repositório contém o backend e o
exemplo de integração; a tela do frontend deve consumir a nova rota.

Se houver proxy, desative o buffering dessa resposta e configure um timeout que
suporte a leitura de uma página lenta. A API envia `X-Accel-Buffering: no` e
`Cache-Control: no-store, no-transform`.

Referências: [streaming no Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#streaming_the_response_body)
e [controle de fluxo no Node HTTP](https://nodejs.org/api/http.html#responsewritechunk-encoding-callback).
