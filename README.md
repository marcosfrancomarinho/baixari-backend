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
O Word é montado em memória e as páginas PDF para OCR são limitadas a 16 milhões
de pixels. Não há fila de processamento nesta versão.

Testes de download e extração (incluem OCR real, sem acesso à internet):

```bash
node --import tsx --test tests/download.test.ts tests/word.test.ts
npm run build
```
