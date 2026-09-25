# Organização e manutenção do código

## Onde alterar cada responsabilidade

| Camada | Responsabilidade | Exemplos |
|---|---|---|
| `app/request` | validar e normalizar entradas | `DocumentRequest`, `PdfConversionRequest` |
| `app/usecase` | coordenar o fluxo e suas regras | download, extração de texto, conversão |
| `app/contracts` | definir as operações oferecidas pelos gateways e serviços | filesystem, upload, conversão |
| `app/services` | operações de aplicação reutilizáveis | localização de documentos |
| `app/strategy` e `app/factory` | selecionar e executar a geração de ZIP ou PDF | estratégias de download |
| `infra` | implementar acesso a disco, bibliotecas e subprocessos | Archiver, pdf-lib, OCR, Ghostscript |
| `presentation/controllers` | adaptar requisição, resposta, streaming e desconexão | controllers HTTP |
| `presentation/http` | traduzir erros para respostas HTTP | status e mensagens de erro |
| `di` | montar e injetar as implementações concretas | providers e tokens tipados |

## Convenções

- Métodos e construtores de classes têm visibilidade explícita: `public` para
  operações expostas, `private` para detalhes internos. Interfaces e funções de
  módulo não aceitam esses modificadores em TypeScript.
- Dependências recebidas por construtor são `private readonly` quando não precisam
  ser substituídas. Estado mutável pertence à operação ou à classe que o controla.
- Métodos de entrada aparecem antes dos auxiliares privados. Nomes indicam a ação
  ou o dado: `extractPdf`, `recognizePdfPage`, `documentCount`, `outputPath`.
- Regras de entrada ficam na aplicação. Controllers não validam documentos nem
  instanciam gateways. Detalhes de parsing, processos e filesystem ficam em `infra`.
- Extraia etapas com responsabilidade própria; evite métodos que apenas renomeiam
  uma linha sem esclarecer o fluxo. Comentários explicam motivos, principalmente
  limites de memória, cancelamento e liberação de recursos.
- Preserve `try/finally` ao reorganizar código com streams, páginas PDF, workers e
  arquivos temporários. A limpeza também precisa ocorrer em erro ou desconexão.

## Fluxos principais

O download valida a requisição, localiza os documentos e seleciona uma estratégia
de saída. O controller entrega o stream usando os metadados retornados.

A extração de texto reutiliza um worker OCR por execução. A implementação separa
leitura do PDF, extração da página, renderização e reconhecimento de imagens. Os
limites de resolução e a pausa entre páginas estão em constantes nomeadas.

A conversão por upload mantém uma vaga de execução até o download terminar. Seus
gateways recebem os arquivos, administram o espaço temporário e executam a
conversão. Os detalhes operacionais estão em
[conversão de documentos](../examples/convert-documents.md).

## Verificação após alterações

```bash
node --import tsx --test tests/*.test.ts
npm run build
```

Defina `GHOSTSCRIPT_PATH` para executar também os testes de conversão real. Os
testes de aplicação usam implementações substitutas dos contratos; os testes de
integração cobrem os streams e as bibliotecas concretas.
