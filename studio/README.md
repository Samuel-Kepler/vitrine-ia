# Vitrine Studio

Monte a página arrastando blocos e clique em **Reimaginar**: a IA transforma o rascunho numa landing page descrita em **[A2UI v1.0](https://a2ui.org/)** (JSON declarativo, catálogo de componentes travado, sem código executável), renderizada ao vivo e exportável em HTML.

Vive dentro do repositório [`vitrine-ia`](..) (inspiração: multi-provedor, mock, preview ao vivo), mas com o A2UI como base. Funciona com IA de nuvem **ou local** (Ollama, LM Studio, llama.cpp, qualquer servidor compatível com OpenAI).

## Rodar

```bash
npm install
cp .env.example .env      # opcional: sem chave nenhuma o app usa o modelo mock
npm run dev               # http://localhost:3200 (porta fixa; a API gerada usa 3001)
```

Funciona igual no Windows (os scripts não usam variáveis no estilo `VAR=x cmd`).

```bash
npm test                  # vitest: compilador A2UI, Reimaginar com mock, árvore do rascunho
npm run typecheck
npm run build
```

## Demonstração rápida

Roteiro de 10 a 15 minutos: do rascunho até a API rodando no Docker.

### 1. Pré-requisitos

- **Node 24** (`node -v`).
- **Docker Desktop aberto**, com **"Engine running"** no canto inferior esquerdo. Confira com `docker version`: precisa aparecer a seção `Server`.
- **Chave do Groq** no `studio/.env`:

  ```
  AI_PROVIDER=groq
  GROQ_API_KEY=gsk_...
  ```

  Deixe **uma só** linha `AI_PROVIDER` (se houver duas, vale a última). Sem chave, o app usa o modelo mock e a demo continua funcionando, mas sem IA.

### 2. Subir o Studio

```powershell
cd studio
npm install
npm run dev
```

Abra **http://localhost:3200**. A porta é fixa: a 3001 fica livre para a API gerada.

### 3. Rascunho da Cafeteria e Reimaginar

1. No modo **UI**, aba **Rascunho**, o Studio abre com o rascunho do **Café Aurora**: menu, hero, benefícios (torra própria, abre às 7h, wifi), formulário "receba novidades" e rodapé. Se o rascunho estiver diferente, limpe os dados do site (F12 → Application → Local Storage → apague `vitrine-studio:v1`) e recarregue a página.
2. Mostre o arrastar e soltar: puxe um bloco da paleta para o canvas e edite o texto no inspetor.
3. Em **Briefing do negócio**, escreva por exemplo: `cafeteria no centro, grãos especiais, wifi pra trabalhar`.
4. Clique em **Reimaginar**. A aba **Landing** mostra a página com o selo **A2UI validado**, o provedor e os tokens usados. Se a IA citar números ou nomes que não estavam no rascunho, aparece um aviso amarelo listando cada um.
5. Opcional: aba **Código A2UI** para mostrar o JSON declarativo e o botão **HTML** para exportar.

### 4. Sugerir da landing (Arquitetura e Banco)

1. Troque para o modo **Arquitetura** e clique em **Sugerir da landing**. A linha **Fonte** mostra o modelo usado (ou o motivo de ter caído na sugestão automática). Vão aparecer:
   - Site → API (rotas `POST /leads`, `GET /leads`);
   - Fila → worker Notificações → serviço de e-mail;
   - API → Banco (grava).
2. Troque para o modo **Banco**: a tabela `leads` (nome, email, origem) já está lá. Ela veio do formulário da landing.
3. Mostre o painel de **revisão** nos dois modos (avisos automáticos, sem IA).

### 5. Gerar os moldes e rodar no Docker

1. No modo **Arquitetura**, clique em **Gerar moldes do backend** → **Baixar .zip** e extraia, por exemplo em `C:\demo\backend`.
2. No PowerShell:

   ```powershell
   cd C:\demo\backend
   docker compose up --build -d
   docker compose ps          # api "healthy"; postgres e redis "healthy"
   ```

3. Grave e leia um lead:

   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:3001/leads -ContentType "application/json" -Body '{"nome":"Ana","email":"ana@ex.com"}'
   Invoke-RestMethod -Uri http://localhost:3001/leads
   ```

4. Mostre o evento chegando no worker:

   ```powershell
   docker compose logs notificacoes
   ```

   Procure por `[notificacoes] evento recebido` com `type: 'leads.created'`.

5. Opcional, validação: um corpo inválido devolve 400 com a lista de campos.

   ```powershell
   try { Invoke-RestMethod -Method Post -Uri http://localhost:3001/leads -ContentType "application/json" -Body '{"email":"x"}' } catch { $_.ErrorDetails.Message }
   ```

Sem baixar o zip, dá para usar o exemplo pronto: `GEN_OUT=examples/backend-cafeteria npx vitest run src/lib/arch` (no Git Bash) gera o mesmo backend em `studio/examples/backend-cafeteria`.

### 6. Encerrar

```powershell
docker compose down -v     # para os containers e apaga o volume do banco
```

No terminal do Studio, `Ctrl+C`.

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

- **Sugerir da landing** lê o rascunho da aba UI e propõe os dois de uma vez: formulário → tabela `leads` + `POST /leads` + fila e worker de notificação; planos → `plans`/`subscriptions` + API de pagamento; depoimentos → `testimonials`; menu ou texto com "Entrar", "Login", "Minha conta", "Área do cliente" (palavra inteira: "Contato" não conta) → Autenticação própria + `users` com `password_hash`, e `POST /subscriptions auth`. Com IA, a resposta vem por saída estruturada (JSON validado por zod); com o mock ou se a IA falhar, usa a inferência determinística (`src/lib/infer/`). A linha **Fonte** na barra lateral diz de onde veio a sugestão e, quando caiu na automática, o motivo.
- **Gerar moldes do backend**: um serviço Node 24 + Hono por API/Serviço/Worker, `docker-compose.yml` (Postgres 17, Redis, MinIO conforme o canvas), `.env.example`, OpenAPI e README. Rota com nome de tabela + ligação “grava” no Postgres sai com SQL pronto; fila vira Redis Streams (`publish`/`consume`).
- **Gerar schema**: SQL para Postgres, MySQL e SQLite, Prisma, Drizzle (pg-core) e DBML. Relações criam as colunas FK sozinhas; muitos-para-muitos cria a tabela de junção.
- **Revisão** sem IA nos dois canvases (ex.: worker sem fila, site acessando o banco direto, tabela sem PK, palavra reservada, auth própria sem Postgres).
- Tudo baixa como `.zip`.

### O que o backend gerado traz

- **Validação**: o corpo de cada `POST /<tabela>` é validado com zod derivado das colunas (`src/schemas.ts`): NOT NULL sem default é obrigatório, `email` vira `z.email()`, uuid/inteiros/datas checados, mensagens em português. Corpo inválido ou JSON quebrado → **400** com `issues`; UNIQUE → **409**; FK inexistente → **409**; erro de tipo no banco → **400**.
- **Docker**: Postgres (`pg_isready` com o nome do banco do canvas) e Redis (`redis-cli ping`) com healthcheck; os serviços esperam com `depends_on: condition: service_healthy`. Dockerfile multi-stage em `node:24-alpine`: `tsc` no build, `npm prune --omit=dev`, usuário `node` (não-root), `npm ci` se houver lockfile, `HEALTHCHECK` em `/health`. O schema só roda na criação do volume: para reaplicar, `docker compose down -v` (apaga os dados).
- **Autenticação** (bloco Autenticação, campo **Tipo** no inspetor):
  - **Própria** (padrão): na API ligada ao bloco (que precisa gravar no Postgres) gera `src/auth.ts` com `POST /auth/register`, `POST /auth/login` (devolvem JWT) e `GET /auth/me`. Senha com `scrypt` do `node:crypto` (sem binário nativo, roda no Alpine), JWT HS256 com `hono/jwt`, `JWT_SECRET` no `.env.example` e no compose. A senha e o hash nunca voltam nas respostas (nem em `GET /users`). O canvas Banco ganha/completa `users` (email único + `password_hash`) sozinho.
  - **Externa**: comportamento anterior, cliente HTTP para a URL do provedor.
  - **Rotas protegidas**: termine a linha com `auth` ou `🔒` (ex.: `POST /subscriptions auth`). Só essas recebem o middleware (sem token → 401). Se a tabela tem FK para `users`, o dono vem do token, não do corpo.

O código gerado é compilado com `tsc` nos testes manuais. Para gravar o backend de exemplo (a pasta `examples/` fica fora do git):

```bash
GEN_OUT=examples/backend-cafeteria npx vitest run src/lib/arch
cd examples/backend-cafeteria && docker compose up --build
```

Diagnóstico do Sugerir com o provedor do `.env`: `RUN_LIVE=1 npx vitest run src/lib/infer/suggest.live.test.ts`.

## Organizar e importar

- **Organizar** (canto superior direito dos canvases Arquitetura e Banco): reposiciona tudo com dagre, da esquerda para a direita, seguindo as ligações (quem chama → quem é chamado; tabela pai → filha).
- **Importar DBML/SQL** (canvas Banco): cole ou abra um `.dbml` (dbdiagram.io) ou `.sql` com `CREATE TABLE` (Postgres, MySQL, SQLite). Lê PK simples e composta, `NOT NULL`, `UNIQUE`, `DEFAULT`, auto-incremento e chaves estrangeiras (inline, `FOREIGN KEY`, `ALTER TABLE` e `Ref:`). Uma tabela com só duas FKs vira relação muitos-para-muitos. Substitui o diagrama, com botão de desfazer, e lista o que precisou ajustar: tipos sem equivalente viram `text`, e a FK é renomeada para `<pai>_id`, porque o Studio nomeia as FKs pela tabela pai.

Leitor próprio (`src/lib/db/import.ts`), sem `@dbml/core`, que pesaria alguns MB. Não lê enums, FKs compostas nem UNIQUE composto: esses casos aparecem nos avisos.

## Exportar o projeto inteiro

O botão **Exportar projeto**, no topo e em qualquer modo, baixa `vitrine-projeto.zip` com:

- `web/index.html`: a landing do último Reimaginar, em HTML estático;
- o backend do canvas Arquitetura (`docker-compose.yml`, serviços, `.env.example`), com um serviço `web` (nginx) que serve a landing em http://localhost:8080;
- `db/`: os schemas do canvas Banco.

Sem Reimaginar, o zip sai sem `web/` e o README avisa. Só com o banco desenhado, saem apenas os schemas.

## Limites conhecidos

- O worker de notificação **recebe** o evento, mas o envio de e-mail é um `TODO` no código gerado.
- O formulário da landing no Studio **não chama** a API gerada: a landing e o backend são gerados lado a lado, sem ligação entre eles.
- A autenticação **Própria** não tem recuperação de senha nem confirmação de e-mail.
- O aviso de "números e nomes novos" é uma checagem simples (sem IA): pode deixar passar fatos inventados sem número nem nome próprio, como "Wi-Fi de alta velocidade".

## Próximos passos

1. Revisão com IA (score + issues) nos três modos, como o Design Review do vitrine-ia.
