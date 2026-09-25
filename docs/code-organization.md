# Organização e manutenção do código

## Onde alterar cada responsabilidade

| Camada | Responsabilidade | Exemplos |
|---|---|---|
| `app/request` | validar e normalizar entradas | `DocumentRequest` |
| `app/usecase` | coordenar os fluxos | download e extração de texto |
| `app/contracts` | definir portas da aplicação | filesystem, PDF, ZIP e extração |
| `app/services` | operações reutilizáveis | localização de documentos |
| `app/strategy` e `app/factory` | selecionar a saída | ZIP ou PDF |
| `infra` | implementar disco e bibliotecas | Archiver, pdf-lib e OCR |
| `presentation/controllers` | adaptar HTTP e streaming | controllers |
| `presentation/http` | traduzir erros HTTP | status e mensagens |
| `di` | montar dependências | providers e tokens |

## Convenções

- Métodos e construtores de classes têm visibilidade explícita.
- Dependências de construtor são `private readonly` quando imutáveis.
- Regras de entrada ficam na aplicação; controllers não validam documentos.
- Detalhes de filesystem e bibliotecas ficam em `infra`.
- Preserve `try/finally` em fluxos com streams, páginas PDF e workers para garantir liberação de recursos.

## Fluxos principais

O download valida a requisição, localiza os documentos e seleciona uma estratégia de saída ZIP ou PDF. O controller entrega o stream usando os metadados retornados.

A extração de texto reutiliza um worker OCR por execução. A implementação separa leitura do PDF, extração da página, renderização e reconhecimento de imagens.

A conversão de arquivos locais escolhidos pelo usuário não faz parte desta API. Ela é executada pelo frontend diretamente no navegador.

## Verificação após alterações

```bash
node --import tsx --test tests/*.test.ts
npm run build
```
