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

O formato PDF retorna o arquivo original quando ha apenas um PDF. Quando ha
varios, une suas paginas em um unico PDF, percorrendo a pasta e subpastas em
ordem de nome (ordenacao numerica). Arquivos de outros formatos sao ignorados.
Uma pasta sem PDFs retorna HTTP 404. A uniao e feita em memoria; o PDF unido
nao preserva as assinaturas digitais dos arquivos originais.

Testes: `node --import tsx --test tests/download.test.ts`.
