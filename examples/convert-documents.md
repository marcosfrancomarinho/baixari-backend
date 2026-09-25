# Upload de imagens e PDFs

`POST /documents/convert/pdf` recebe `multipart/form-data` com o campo repetido
`files`. Aceita PDF, JPG/JPEG e PNG, identificados pelo conteúdo, e retorna
`application/pdf` com download de `documentos.pdf`. A ordem das partes enviadas
define a ordem dos documentos; as páginas internas de cada PDF mantêm sua ordem.
Não existe limite fixo de quantidade de arquivos nem de páginas nesta rota.

```bash
curl -X POST http://localhost:3000/documents/convert/pdf \
  -F "files=@documento.pdf" \
  -F "files=@foto.jpg" \
  -F "files=@comprovante.png" \
  --output documentos.pdf
```

No Windows PowerShell, use `curl.exe` e coloque o comando em uma linha.

## Preparação do servidor

Instale as dependências com `yarn install` e instale o
[Ghostscript](https://www.ghostscript.com/releases/gsdnld.html) no servidor.
Configure `GHOSTSCRIPT_PATH` com o caminho do executável ou deixe `gs` (Linux)
ou `gswin64c` (Windows) acessível no PATH.

```powershell
$env:GHOSTSCRIPT_PATH = 'C:\Program Files\gs\<versao>\bin\gswin64c.exe'
npm.cmd run build
npm.cmd start
```

Sem o executável, a nova rota responde `503`; as rotas existentes continuam
funcionando. A aplicação lê variáveis do ambiente; não carrega `.env` sozinha.

## Recursos e configuração

| Variável | Padrão | Finalidade |
|---|---|---|
| `GHOSTSCRIPT_PATH` | `gswin64c` no Windows; `gs` no Linux | executável nativo |
| `PDF_TEMP_DIR` | temporários do sistema | volume para uploads e PDF de saída |
| `PDF_MAX_CONCURRENT` | `1` | trabalhos simultâneos por processo da API, incluindo upload e download |
| `PDF_MAX_FILE_BYTES` | `52428800` (50 MiB) | tamanho máximo de **cada arquivo**, não do conjunto |
| `PDF_MAX_IMAGE_PIXELS` | `40000000` | máximo de pixels por imagem de entrada |
| `PDF_IMAGE_MAX_SIDE` | `3000` | lado máximo da imagem incorporada, sem ampliar imagens menores |
| `PDF_MIN_FREE_BYTES` | `1073741824` (1 GiB) | reserva mínima de espaço no volume temporário |
| `PDF_UPLOAD_IDLE_MS` | `60000` | tempo de inatividade permitido durante o upload |

Todas as variáveis numéricas devem ser inteiros positivos. Não há teto de bytes
para o conjunto nem tempo máximo total imposto pela rota. O servidor HTTP, o
proxy e o cliente podem impor seus próprios limites; ajuste-os para uploads longos.

Os arquivos chegam por streaming com controle de fluxo e nomes internos gerados.
O servidor não mantém uma lista com todos os arquivos em RAM. Um subprocesso
normaliza uma imagem por vez, aplica orientação EXIF, fundo branco para transparência
e JPEG de qualidade 90. As imagens ocupam páginas proporcionais de até A4.
PDFs são encaminhados ao Ghostscript sem rasterização prévia. A lista de entradas
fica em disco e o Ghostscript grava o resultado diretamente em arquivo, com a
detecção de imagens duplicadas desativada para evitar acumular essa tabela em RAM.
O download usa streaming com controle de fluxo para clientes lentos.

O heap JavaScript do subprocesso de imagens tem limite de 192 MiB. **Isso não é um
limite de RAM total:** buffers, Sharp e Ghostscript usam memória nativa, e a
complexidade dos PDFs pode aumentar o consumo. Para um teto rígido, execute o
serviço em um contêiner ou processo com limite de memória do sistema operacional.
A quantidade é ilimitada pela aplicação, mas permanece sujeita a espaço em disco,
recursos da máquina e limites dos clientes. A reserva de disco é verificada durante
o upload e a cada segundo durante o trabalho; não representa uma quota rígida.

Ao desconectar o cliente, o processo ativo é encerrado e os temporários são
removidos. Eles também são removidos após sucesso ou erro. Uma interrupção abrupta
do servidor ou do sistema pode deixar pastas `baixari-pdf-*`; use um volume
temporário dedicado com política de limpeza de pastas antigas quando não houver
trabalhos ativos. Em múltiplas instâncias, o limite de concorrência é por instância.

## Respostas de erro

| HTTP | Motivo |
|---|---|
| `400` | multipart inválido, nenhum arquivo ou campo diferente de `files` |
| `408` | upload inativo |
| `413` | um arquivo excedeu o tamanho permitido |
| `415` | requisição não é `multipart/form-data` |
| `422` | documento inválido/protegido, formato incompatível, imagem animada ou limite de processamento |
| `503` | conversor ocupado (`Retry-After: 10`) ou dependência indisponível |
| `507` | espaço em disco insuficiente |
| `500` | falha interna de infraestrutura |

Os erros anteriores ao download retornam `{ "error": "mensagem" }`; uma falha
durante o download encerra a conexão. Nenhum PDF parcial é enviado se a conversão
falhar. O PDF é recriado: assinaturas digitais, formulários interativos, anexos e
outros recursos não visuais não têm preservação garantida. Imagens são recomprimidas.

## Organização do código

- `PdfConversionController` adapta o multipart para uma entrada de streaming,
  acompanha a desconexão e entrega a resposta HTTP.
- `PdfConversionRequest` valida o tipo de entrada na aplicação, antes de acessar
  qualquer gateway. O controller delega a tradução de erros ao adaptador HTTP.
- `PdfConversionUseCase` coordena upload, conversão, concorrência e limpeza.
  Também exige pelo menos um documento e rejeita resultados vazios.
  Mantém o espaço temporário e a vaga de execução até terminar o consumo do PDF.
- Os contratos `DocumentUploadGateway`, `PdfConversionGateway` e
  `ConversionWorkspaceGateway` ficam em `app/contracts`.
- `DiskDocumentUpload`, `DiskPdfConversion` e `FsConversionWorkspaceGateway`
  implementam os contratos em `infra`, isolando Busboy, subprocessos e filesystem.
- O upload informa o progresso em bytes e aguarda o callback da aplicação.
  O use case decide quando verificar espaço e chama o gateway de temporários;
  `DiskDocumentUpload` não depende de outro gateway.
- `di/providers.ts` monta e injeta as implementações usando tokens tipados de
  `di/tokens.ts`. Controllers e casos de uso não instanciam infraestrutura.

O caso de uso não depende de Express nem de implementações de infraestrutura.
Seus testes usam gateways substitutos para verificar falhas, cancelamento,
concorrência e limpeza sem acessar disco ou iniciar Ghostscript.

## Verificação

```bash
node --import tsx --test tests/pdf.conversion.test.ts
```

Defina `GHOSTSCRIPT_PATH` para incluir os testes de união real, ordenação,
150 imagens e rejeição de documentos corrompidos. Sem essa variável, somente os
testes que dependem do Ghostscript são pulados.
