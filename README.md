# Vitrine · landing pages com IA

Gerador de landing pages e componentes React **animados** para pequenos negócios. Você descreve o negócio do cliente; a IA cria os arquivos em loop, você vê cada passo numa timeline e o preview aparece ao vivo. Depois, um **Design Review** devolve um objeto validado (score + issues) que a aplicação consome.

Projeto da Aula 1 da Especialização em Desenvolvimento com IA (PDA), construído sobre o **UIGen** do curso da Anthropic. Material da aula: [`docs/aula1/ROTEIRO.md`](docs/aula1/ROTEIRO.md).

![Vitrine gerando uma landing de cafeteria](docs/aula1/screens/08-review-resultado.png)

## O que tem aqui dentro

| Conceito | Onde |
|---|---|
| Streaming (`streamText` → `toUIMessageStream`) | `src/app/api/chat/route.ts` |
| System prompt + cache | `src/lib/prompts/generation.tsx` |
| Tools com `inputSchema` + loop agêntico (`stopWhen`) | `src/lib/tools/`, `src/app/api/chat/route.ts` |
| Structured output (`generateText` + `Output.object`) | `src/lib/review/`, `src/app/api/review/route.ts` |
| Cliente: `useChat` + `DefaultChatTransport` + `onToolCall` | `src/lib/contexts/chat-context.tsx` |
| Troca de provedor por `.env` | `src/lib/provider.ts` |
| Modelo mock (roda sem chave) | `src/lib/mock-model.ts` |

## Pré-requisitos

- Node.js 22+ (exigido pelo AI SDK 7)
- npm

## Setup

```bash
cp .env.example .env     # preencha SÓ o provedor que for usar (ou nenhum, para o mock)
npm run setup            # instala, gera o Prisma client e cria o banco SQLite
npm run dev              # http://localhost:3000
```

Sem nenhuma chave o app roda com o **modelo mock**: streaming, timeline, preview e Design Review funcionam com respostas fixas. Bom para testar a interface e para o CI.

## Provedores

Escolha com `AI_PROVIDER` no `.env`. `AI_MODEL` é opcional e sobrescreve o modelo padrão. Sem `AI_PROVIDER`, o app usa o primeiro provedor que tiver chave.

| `AI_PROVIDER` | Variável da chave | Modelo padrão | Custo | Onde pegar a chave |
|---|---|---|---|---|
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-flash-latest` | free tier | [Google AI Studio](https://aistudio.google.com/apikey) |
| `groq` | `GROQ_API_KEY` | `openai/gpt-oss-120b` | free tier | [console.groq.com/keys](https://console.groq.com/keys) |
| `openrouter` | `OPENROUTER_API_KEY` | `nvidia/nemotron-3-ultra-550b-a55b:free` | modelos `:free` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-5-5` | pago | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `mock` | – | `mock-uigen` | grátis, offline | – |

### Gemini (Google AI Studio)

```
AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=sua-chave
```

Crie a chave no AI Studio com sua conta Google. Confira os termos do free tier: nele, o Google pode usar o conteúdo enviado para melhorar os produtos. Não mande dado de cliente real.

### Groq

```
AI_PROVIDER=groq
GROQ_API_KEY=sua-chave
```

Muito rápido, com limite de requisições/tokens por minuto. Se aparecer erro de *rate limit* (limite de uso), espere um minuto ou use um modelo menor via `AI_MODEL`.

### OpenRouter

```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sua-chave
# AI_MODEL=outro-modelo:free
```

Os modelos `:free` entram e saem do catálogo. Se o padrão sumir, liste os gratuitos atuais e troque o `AI_MODEL`:

```bash
curl -s https://openrouter.ai/api/v1/models | jq -r '.data[].id' | grep ':free'
```

Escolha um modelo com suporte a *tool calling* (chamada de ferramentas), senão o loop não funciona.

### Como testar a troca de provedor

1. Edite `AI_PROVIDER` (e a chave) no `.env`. O `next dev` recarrega o `.env` sozinho; recarregue a página.
2. O **badge no topo** mostra `provedor · modelo`. Vermelho = configuração errada (passe o mouse para ver o motivo).
3. Gere uma landing e rode o Design Review. O terminal loga `[chat] provedor/modelo`, `[chat] fim: <motivo> · <passos> · <tokens>` e `[review] provedor/modelo`.
4. Rode o e2e contra o provedor: `E2E_PROVIDER=google npx playwright test` (troque pelo provedor que quiser).

Cada aluno usa a própria chave: a cota é por conta/projeto. **Nunca** commite o `.env` (ele já está no `.gitignore`).

## Testes

```bash
npm test                 # unitários (vitest)
npm run lint
npm run build
npm run test:e2e         # Playwright com o mock: fluxo completo, roda no CI
npm run test:e2e:real    # mesmo fluxo com o Haiku (usa ANTHROPIC_API_KEY do .env), fora do CI
```

Na primeira vez: `npx playwright install chromium`. O Next 16 só aceita um `next dev` por pasta, então pare o `npm run dev` antes do e2e.

## Design Review

`POST /api/review` com `{ files }` (o sistema de arquivos virtual serializado) devolve:

```ts
{ review: { score: number, summary: string, issues: ReviewIssue[] }, provider, modelId }
```

O schema está em `src/lib/review/schema.ts`, junto com `reviewToIssues(review)`, que formata cada issue como `{ title, body, labels }` para abrir no GitHub (usado na Aula 2).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · `motion` · AI SDK 7 · Zod 4 · Prisma + SQLite · Monaco · Vitest + Testing Library · Playwright

## Origem

Baseado no **UIGen**, projeto do curso *Claude Code in Action* da Anthropic. Migrado para Next 16 / AI SDK 7 e estendido para a aula (UI, Design Review, multi-provedor, mock, e2e e material didático).

> **Sobre licença:** o código original do UIGen foi distribuído pelo curso sem licença open source explícita. Este repositório é material educacional e não adiciona uma licença própria; os direitos sobre o código original continuam com a Anthropic. Use para estudo.
