# Vitrine Studio

Monte a página arrastando blocos e clique em **Reimaginar**: a IA transforma o rascunho numa landing page descrita em **[A2UI v1.0](https://a2ui.org/)** (JSON declarativo, catálogo de componentes travado, sem código executável), renderizada ao vivo e exportável em HTML.

Irmão do [`vitrine-ia`](../vitrine-ia) (inspiração: multi-provedor, mock, preview ao vivo), mas com o A2UI como base. Funciona com IA de nuvem **ou local** (Ollama, LM Studio, llama.cpp, qualquer servidor compatível com OpenAI).

## Rodar

```bash
npm install
cp .env.example .env      # opcional: sem chave nenhuma o app usa o modelo mock
npm run dev               # http://localhost:3000
```

Funciona igual no Windows (os scripts não usam variáveis no estilo `VAR=x cmd`).

```bash
npm test                  # vitest: compilador A2UI, Reimaginar com mock, árvore do rascunho
npm run typecheck
npm run build
```

## Como funciona

```
Rascunho (árvore de blocos)  ──►  /api/reimagine  ──►  modelo (nuvem, local ou mock)
                                        │                    │ escreve A2UI Express
                                        │  @a2ui/agent compila e valida contra o catálogo
                                        │  erro? volta para o modelo (até 3 tentativas)
                                        │  falhou de vez? versão automática do rascunho
                                        ▼
                      mensagens A2UI v1.0  ──►  MessageProcessor (web_core/v1_0) + <A2uiSurface> (React)
```

| Peça | Onde |
|---|---|
| Blocos do rascunho, árvore e operações | `src/lib/draft/` |
| Rascunho → A2UI Express determinístico (mock, plano B, esqueleto do prompt) | `src/lib/draft/to-express.ts` |
| Catálogo A2UI (contrato zod, usado pelo servidor e pelo navegador) | `src/lib/a2ui/catalog-api.ts` |
| Implementações React do catálogo | `src/lib/a2ui/views.tsx` |
| Prompt + compilação/validação (`@a2ui/agent`) | `src/lib/a2ui/agent.ts`, `src/lib/reimagine/` |
| Provedores (nuvem, Ollama, OpenAI-compatível, mock) | `src/lib/ai/` |
| Editor (paleta, canvas, inspetor, landing, código) | `src/components/studio/` |

O catálogo tem os componentes básicos do A2UI (`Column`, `Row`, `Text`, `Button`, `Card`, `Image`, `TextField`…) mais os de landing: `Page`, `Navbar`, `Hero`, `Heading`, `Section`, `Grid`, `Feature`, `Testimonial`, `PricingCard`, `Footer`.

## IA local

Escolha na engrenagem do topo (fica salvo só no navegador) ou no `.env`:

| Servidor | Provedor | URL padrão |
|---|---|---|
| Ollama | `ollama` | `http://localhost:11434/api` (contexto ajustado para 16k) |
| LM Studio | `openai-compatible` | `http://localhost:1234/v1` |
| llama.cpp | `openai-compatible` | `http://127.0.0.1:8080/v1` |
| OpenRouter | `openai-compatible` | `https://openrouter.ai/api/v1` |

“Listar modelos do servidor” consulta `/api/tags` (Ollama) ou `/v1/models`. Provedores locais nunca são escolhidos sozinhos. URLs vindas da tela só são aceitas se forem locais ou estiverem em `ALLOWED_REMOTE_HOSTS` (proteção contra SSRF).

Ollama sugerido para começar: `ollama pull qwen2.5-coder:7b`. Modelos pequenos erram mais o A2UI Express; o app devolve o erro do compilador para o modelo corrigir e, no pior caso, mostra a versão automática.

## Armadilhas conhecidas (ver `docs/research/_consolidated.md`)

- `@a2ui/react` acessa `HTMLElement` ao ser importado: só carregue no navegador (`next/dynamic` com `ssr:false`).
- Uma única cópia de `@a2ui/web_core@0.15.0`: está fixada no `package.json` e o `overrides` força o `@a2ui/markdown-it` a usá-la. `zod` fica em 3.25.76 (exigência do `@a2ui/react`).
- O tema padrão dos componentes básicos usa `light-dark()`; a landing fixa `color-scheme: light` e mapeia `--a2ui-*` para a paleta.
- `Text` do catálogo básico não tem tamanho de título: use `Heading`.

## Arquitetura e Banco

Os modos **Arquitetura** e **Banco** (topo) são canvases React Flow que dividem o mesmo projeto:

- **Sugerir da landing** lê o rascunho da aba UI e propõe os dois de uma vez: formulário → tabela `leads` + `POST /leads` + fila e worker de notificação; planos → `plans`/`subscriptions` + API de pagamento; depoimentos → `testimonials`; texto com "login/conta" → bloco de Autenticação + `users`. Com IA, a resposta vem por saída estruturada (JSON validado por zod); com o mock ou se a IA falhar, usa a inferência determinística (`src/lib/infer/`).
- **Gerar moldes do backend**: um serviço Node 24 + Hono por API/Serviço/Worker, `docker-compose.yml` (Postgres 17, Redis, MinIO conforme o canvas), `.env.example`, OpenAPI e README. Rota com nome de tabela + ligação “grava” no Postgres sai com SQL pronto; fila vira Redis Streams (`publish`/`consume`).
- **Gerar schema**: SQL para Postgres, MySQL e SQLite, Prisma, Drizzle (pg-core) e DBML. Relações criam as colunas FK sozinhas; muitos-para-muitos cria a tabela de junção.
- **Revisão** sem IA nos dois canvases (ex.: worker sem fila, site acessando o banco direto, tabela sem PK, palavra reservada).
- Tudo baixa como `.zip`.

O código gerado foi compilado com `tsc` (ver `src/lib/arch/codegen.test.ts`: `GEN_OUT=<pasta> npx vitest run src/lib/arch` grava o backend de exemplo).

## Próximos passos

1. Revisão com IA (score + issues) nos três modos, como o Design Review do vitrine-ia.
2. Exportar a landing como projeto (HTML + o backend + o banco num único zip).
3. Auto-layout (dagre) e importar DBML/SQL existente.
