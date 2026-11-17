# vitrine-ia: o que reaproveitar da camada de IA (AI plumbing)

Estudo somente leitura de `~/Projetos/Vitrine/vitrine-ia`. Nada foi alterado no repositório de referência.
Data de referência: 2026-11-17. Máquina: Windows 11, Node v26.13.0, npm 11.20.0.

Legenda: **VERIFIED (como)** = confirmado lendo o código/`.d.ts` instalado, rodando comando ou consultando fonte oficial. **ASSUMED** = inferência ou conhecimento não testado nesta máquina.

---

## 0. Versões (VERIFIED: `node -p require(.../package.json).version` no node_modules do repo e `npm view`)

| Pacote | Instalado no repo | Último no registro (npm view) | Obs. |
|---|---|---|---|
| `ai` | 7.0.173 | 7.0.173 | depende de `@ai-sdk/provider` 4.0.38, `@ai-sdk/gateway` 4.0.146, `@ai-sdk/provider-utils` 5.0.81; peer zod `^3.25.76 \|\| ^4.1.8` |
| `@ai-sdk/provider` | 4.0.38 | 4.0.38 | define `LanguageModelV4` (`specificationVersion: 'v4'`) |
| `@ai-sdk/anthropic` | 4.0.105 | 4.0.105 | |
| `@ai-sdk/google` | (no package.json deps: `^4.0.121`) | 4.0.121 | |
| `@ai-sdk/groq` | (`^4.0.84`) | 4.0.84 | |
| `@openrouter/ai-sdk-provider` | (`^3.1.0`) | 3.1.0 | |
| `@ai-sdk/react` | (`^4.0.177`) | não consultado | |
| `zod` | 4.6.7 | não consultado | `package.json` pede `^4.1.8` |
| `vitest` | 3.2.7 | não consultado | `package.json` pede `^3.2.4` |
| `@ai-sdk/openai` | **não instalado** | 4.0.118 | usa provider 4.0.38, implementa V4 (VERIFIED: tarball) |
| `@ai-sdk/openai-compatible` | **não instalado** | 3.0.92 | **número de major é enganoso**: implementa `LanguageModelV4` (VERIFIED: tarball, `specificationVersion = "v4"`, `createOpenAICompatible`) |
| `ollama-ai-provider-v2` | **não instalado** | 4.1.0 | provider Ollama nativo; peer `ai ^7.0.0`, `zod ^4.0.16`; deps `@ai-sdk/provider ^4.0.21` (VERIFIED: `npm view`, tarball usa `LanguageModelV4` e exporta `createOllama`) |

Os tarballs foram baixados com `npm pack` para `scratchpad/pkgcheck/` (fora do repo).

Atenção: o `@ai-sdk/openai-compatible` mais recente é **3.0.92**, não 4.x. Para o AI SDK 7 (V4) é o pacote certo para "qualquer servidor OpenAI-compatible". Não confie no número da major ao escolher.

---

## 1. Seleção de provedor

### 1.1 Código (VERIFIED: `src/lib/provider.ts`, lido por completo)

```ts
export const PROVIDERS = ["anthropic", "google", "groq", "openrouter"] as const;
export type ProviderId = (typeof PROVIDERS)[number] | "mock";

export const API_KEY_ENV: Record<Exclude<ProviderId, "mock">, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-haiku-5-5",
  google: "gemini-flash-latest",
  groq: "openai/gpt-oss-120b",
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  mock: "mock-uigen",
};

export function resolveProvider(env = process.env): ProviderId {
  const requested = env.AI_PROVIDER?.trim().toLowerCase();
  if (requested) {
    if (requested === "mock") return "mock";
    if (!(PROVIDERS as readonly string[]).includes(requested)) throw new Error(/* "não é suportado" */);
    const provider = requested as Exclude<ProviderId, "mock">;
    if (!env[API_KEY_ENV[provider]]?.trim()) throw new Error(/* "AI_PROVIDER=x, mas KEY não está definida" */);
    return provider;
  }
  return PROVIDERS.find((p) => Boolean(env[API_KEY_ENV[p]]?.trim())) ?? "mock";
}

function buildModel(provider: ProviderId, modelId: string): LanguageModel {
  const fetch = isAIDebug() && provider !== "mock" ? createDebugFetch(provider) : undefined;
  switch (provider) {
    case "anthropic":  return createAnthropic({ fetch })(modelId);
    case "google":     return createGoogle({ fetch })(modelId);
    case "groq":       return createGroq({ fetch })(modelId);
    case "openrouter": return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY, fetch })(modelId);
    case "mock":       return new MockLanguageModel(modelId);
  }
}

export function getModelConfig(): ModelConfig {           // chamado A CADA request
  const provider = resolveProvider();
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  return { provider, modelId, model: buildModel(provider, modelId) };
}

export function getActiveModelInfo(env = process.env): ActiveModelInfo {  // só para o badge da UI
  try { const provider = resolveProvider(env); return { provider, modelId: env.AI_MODEL?.trim() || DEFAULT_MODELS[provider] }; }
  catch (error) { return { provider: (env.AI_PROVIDER?.trim().toLowerCase() || "mock") as ProviderId, modelId: "não configurado", error: (error as Error).message }; }
}
```

Regras (VERIFIED, também cobertas por `src/lib/__tests__/provider.test.ts`):
- `AI_PROVIDER` ausente: primeiro provedor com chave, na ordem `anthropic, google, groq, openrouter`; sem nenhuma chave, `mock`.
- `AI_PROVIDER=x` sem a chave correspondente: **erro** (não cai para mock).
- `AI_PROVIDER=mock`: mock mesmo com chaves.
- `AI_PROVIDER` desconhecido: erro "não é suportado".
- `AI_MODEL` sobrescreve o modelo padrão.

Variáveis de ambiente (VERIFIED: só os nomes, lidos de `.env`, valores NÃO copiados):
`AI_PROVIDER`, `AI_MODEL`, `ANTHROPIC_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `JWT_SECRET` (sessão, não é IA).
Outras lidas no código/scripts: `AI_DEBUG` (`1` ou `true`), `MOCK_TOKEN_DELAY_MS` (default 18), `E2E_PROVIDER` (Playwright).

Nota: `.env` do repo tem comentário em português dizendo "copie para .env" e referencia `.env.example`, que **não existe** na raiz (VERIFIED: `ls`). Não copie o arquivo `.env`; crie um `.env.example` só com nomes.

### 1.2 O que muda para adicionar provedor LOCAL (Ollama / LM Studio / qualquer OpenAI-compatible)

Pontos de mudança em `provider.ts`:
1. Adicionar `"openai-compatible"` (ou `"ollama"`, `"lmstudio"`) em `PROVIDERS`.
2. **Não exigir chave**: `resolveProvider` hoje lança erro se a chave não existe e o auto-detect só olha chaves. Para local, o check precisa ser por "base URL configurada" ou por flag explícita. Recomendação: auto-detect **nunca** escolhe local (evita trocar silenciosamente um provedor pago por um modelo fraco local); só `AI_PROVIDER=...` seleciona.
3. Adicionar `baseURL` e `modelId` ao `ModelConfig`/env, p.ex. `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY` (opcional), `OPENAI_COMPATIBLE_MODEL`.
4. `buildModel`: novo case.

Código sugerido (ASSUMED até rodar; API verificada no `.d.ts` do pacote, ver abaixo):

```ts
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

case "local":
  return createOpenAICompatible({
    name: "local",                                   // aparece em providerMetadata/logs
    baseURL: process.env.LOCAL_BASE_URL!,            // ex.: http://localhost:11434/v1
    apiKey: process.env.LOCAL_API_KEY ?? "not-needed",
    fetch,
    supportsStructuredOutputs: false,                // ver nota abaixo
  })(modelId);
```

Assinatura VERIFIED (`createOpenAICompatible` em `dist/index.d.ts` do tarball 3.0.92):
`createOpenAICompatible<...>(options: OpenAICompatibleProviderSettings): OpenAICompatibleProvider`, com `baseURL: string`, `name: string` (obrigatórios), e opcionais `apiKey`, `headers`, `queryParams`, `fetch`, `includeUsage`, `supportsStructuredOutputs`, `supportsMultiPartToolContent`, `transformRequestBody`, `metadataExtractor`.

Endpoints locais:
- **Ollama, modo OpenAI-compatible** (VERIFIED: https://ollama.com/blog/openai-compatibility): base URL `http://localhost:11434/v1`; chat em `/v1/chat/completions`; a chave é obrigatória no cliente mas ignorada: use `'ollama'`.
- **Ollama, API nativa**: pacote `ollama-ai-provider-v2@4.1.0` com `createOllama({ baseURL? })`. Default da baseURL NÃO verificado (ASSUMED: `http://127.0.0.1:11434/api`). Alternativa se quiser recursos específicos do Ollama. Não testado com Output.object.
- **LM Studio** (VERIFIED: https://lmstudio.ai/docs/developer/openai-compat): exemplo usa `http://localhost:1234/v1`; endpoints `/v1/models`, `/v1/responses`, `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`. A página **não diz** se tool calling e response_format são suportados (ver páginas "Tool Use" e "Structured Output" do LM Studio, não lidas). Porta 1234 como default: ASSUMED pelo exemplo.
- Ollama NÃO está instalado nesta máquina (informado no enunciado; não reverificado).

Nota sobre structured output em servidores locais: `supportsStructuredOutputs` controla se o provedor manda `response_format` com json_schema. Se o servidor não suportar, use `false` (ASSUMED: comportamento do flag, pelo nome; não testado).

### 1.3 Escolha de provedor/modelo/baseURL pela UI em runtime (sem depender só do .env)

O repo lê `process.env` a cada request (`getModelConfig()` dentro do POST de `/api/chat` e `/api/review`). Então dá para aceitar override por request. Padrão recomendado (design, não existe no repo: ASSUMED como proposta):

1. Client envia no body: `{ messages, files, projectId, model: { provider, modelId, baseURL? } }`. Hoje o body do `chat-context.tsx` manda só `{ files, projectId }` via `sendMessage(..., { body })`.
2. Servidor valida com zod: `provider` em lista branca; `baseURL` só para `local` e **com allowlist de host** (evitar SSRF se o servidor for público); nunca aceitar chave de API vinda do cliente.
3. `getModelConfig(override?)` usa o override se válido, senão cai no env.
4. Persistir a escolha do usuário em `localStorage` (permitido pelo guia: preferência por viewer) e nunca a chave.
5. Expor `GET /api/models` que lista modelos do servidor local: OpenAI-compatible responde `GET /v1/models` (VERIFIED para LM Studio na lista de endpoints; Ollama também tem `/v1/models`, não verificado nesta sessão).
6. `getActiveModelInfo` (badge) precisa aceitar o override; hoje é só do env.

Pontos do repo que assumem provedor fixo e devem ser generalizados:
- `route.ts`: `forceFirstTool = isNewProject && provider !== "anthropic" && provider !== "mock"` (VERIFIED). Local deve entrar nesse grupo (modelos fracos).
- `route.ts`: `stopWhen: isStepCount(provider === "mock" ? 4 : 40)` (VERIFIED).
- `ai-errors.ts`: mensagens citam Groq/free tier; tratar local ("servidor local não respondeu: confira se o Ollama/LM Studio está rodando").
- Em `friendlyAIError`, erro sem `statusCode` vira "Não deu para conectar ao {provider}" (VERIFIED): serve bem para servidor local fora do ar.

---

## 2. Mock model: como implementa `LanguageModelV4` (VERIFIED: `src/lib/mock-model.ts` lido por completo; tipos em `@ai-sdk/provider/dist/index.d.ts`)

### 2.1 Contrato mínimo do V4 (VERIFIED: `export type LanguageModelV4 = {...}`)

```ts
type LanguageModelV4 = {
  readonly specificationVersion: 'v4';
  readonly provider: string;
  readonly modelId: string;
  supportedUrls: PromiseLike<Record<string, RegExp[]>> | Record<string, RegExp[]>;
  doGenerate(options: LanguageModelV4CallOptions): PromiseLike<LanguageModelV4GenerateResult>;
  doStream(options: LanguageModelV4CallOptions): PromiseLike<LanguageModelV4StreamResult>;
};
```

`LanguageModelV4StreamResult = { stream: ReadableStream<LanguageModelV4StreamPart>; request?; response? }`.

### 2.2 Partes de stream (VERIFIED: união `LanguageModelV4StreamPart`)

- `{ type: 'stream-start', warnings: [] }`
- `{ type: 'text-start', id }`, `{ type: 'text-delta', id, delta }`, `{ type: 'text-end', id }`
- `{ type: 'reasoning-start'|'reasoning-delta'|'reasoning-end', id, ... }`
- `{ type: 'tool-input-start', id, toolName }`, `{ type: 'tool-input-delta', id, delta }`, `{ type: 'tool-input-end', id }` (streaming de argumentos da tool; o mock NÃO usa isso)
- `LanguageModelV4ToolCall`: `{ type: 'tool-call', toolCallId: string, toolName: string, input: string }`. **`input` é string JSON**, não objeto.
- `{ type: 'finish', usage, finishReason: { unified, raw } }`, onde `unified` ∈ `'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'interrupted' | 'other'` (VERIFIED).
- `{ type: 'error', error }`, `{ type: 'raw', rawValue }`, `{ type: 'ping' }`, `response-metadata`, `file`, `source`, `tool-result`, `custom` (VERIFIED: existem no union).

`LanguageModelV4ToolChoice` (VERIFIED): `{type:'auto'} | {type:'none'} | {type:'required'} | {type:'tool', toolName}`.

### 2.3 Como o mock funciona

```ts
export class MockLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};
  tokenDelayMs: number;                 // MOCK_TOKEN_DELAY_MS, default 18; testes usam 0 ou 12
```

- **Passo do loop agêntico** = número de mensagens `role: "tool"` no prompt (`messages.filter(m => m.role === "tool").length`). Então o mock é determinístico: passo 0 cria `/App.jsx`, passo 1 cria o componente, passo 2 faz `str_replace`, passo 3 responde só texto e `finish: stop`.
- **Tipo de site** por regex no último texto do usuário (`landing|página|site` → landing, `form|contato` → form, `card|preço|pricing` → card; default landing).
- Cada passo chama `this.streamText(texto)` (text-start, um text-delta por palavra com `\S+\s*` e `await delay(tokenDelayMs*3)`, text-end) e depois `this.toolCall(id, input)` que retorna `{type:'tool-call', toolCallId, toolName:'str_replace_editor', input: JSON.stringify(input)}`, e por fim `this.finish('tool-calls')`.
- `doStream` envolve o gerador em `new ReadableStream({ start(controller) {...} })`, enfileira `stream-start` e depois cada chunk; `controller.error` em exceção.
- `doGenerate` coleta as mesmas partes do gerador: concatena `text-delta` em um texto, junta `tool-call`s, pega o `finish`.
- **Structured output**: `if (options.responseFormat?.type === "json")` devolve `content: [{type:'text', text: JSON.stringify(...)}]`. O mock monta um `DesignReview` a partir dos caminhos `### FILE: /...` que aparecem no prompt (regex `/### FILE: (\/[^\s\\]+)/g`).
- Tipo do `usage` (VERIFIED): `inputTokens: {total, noCache, cacheRead, cacheWrite}`, `outputTokens: {total, text, reasoning}`.

### 2.4 Receita para um mock que emite JSON A2UI (ASSUMED como design; a spec A2UI NÃO foi lida nesta tarefa)

Para teste e demo offline:
- Manter a mesma forma: classe com `specificationVersion='v4'`, `doStream` com `ReadableStream`, e `doGenerate` que coleta as partes.
- Para cada "passo", emitir `tool-call` cujo `input` é a string JSON com o payload de mensagem A2UI (uma tool `emit_a2ui` com `inputSchema` zod, ou simplesmente `responseFormat: json` com schema), em vez de `str_replace_editor`.
- Respostas fixas por "tipo de canvas" (como `kindFor`), derivadas do JSON do canvas que chega no prompt, para o teste ser determinístico.
- Para structured output, responder `responseFormat.type === 'json'` com o JSON pronto (igual ao `mockReview`).
- Tempo entre chunks via env (`MOCK_TOKEN_DELAY_MS`), zerado nos testes.

---

## 3. Guardrails para modelos fracos (VERIFIED nos arquivos citados)

| Guardrail | Onde | Como funciona | Transfere para o caso A2UI/local? |
|---|---|---|---|
| **Forçar 1ª tool call** | `route.ts`: `prepareStep: ({stepNumber}) => stepNumber === 0 && forceFirstTool ? { toolChoice: { type: "tool", toolName: "str_replace_editor" } } : undefined` | Projeto novo + provedor não-Anthropic/mock: passo 0 obriga a tool. Motivo no comentário: gpt-oss no Groq às vezes "responde" colando código no chat. | **Sim**. Para A2UI, obrigar a tool de emitir o primeiro surface/componentes. |
| **Syntax check após cada escrita** | `tools/str-replace.ts`: `withSyntaxCheck(fs, path, result)` compila com `transformJSX` (Babel) e anexa `ERRO DE SINTAXE em ... Corrija este arquivo agora com str_replace.` | O erro volta como resultado da tool e o modelo corrige no passo seguinte. | **Adaptar**: trocar por validação de JSON + schema A2UI (zod) e devolver o erro de validação como resultado da tool. O padrão (validar na própria tool e devolver erro acionável) é o que transfere. |
| **Retries em 429** | `maxRetries: 6` em `streamText` e `generateText` | Comentário diz que o SDK espera o `retry-after` do header e tenta de novo. | Manter. **ASSUMED** o comportamento do `retry-after` (não li o código do retry no `ai` 7 nesta sessão). |
| **Limite de passos** | `stopWhen: isStepCount(provider === "mock" ? 4 : 40)` | Evita loop infinito. | Manter; o mock usa 4. |
| **Limite de saída** | `maxOutputTokens: 32_000` | Landing grande; `finishReason: "length"` para no meio. | Ajustar para JSON de canvas. |
| **Erro para o usuário** | `onError: (error) => friendlyAIError(error, provider)` em `toUIMessageStream` | Sem isso o navegador recebe "An error occurred.". | Manter. |
| **Prompt que proíbe colar código no chat** | `prompts/generation.tsx`: "Files only exist if you create them with the str_replace_editor tool. Never paste code in the chat." | Reforça a tool. | Trocar a regra por "Responda somente chamando a tool emit_a2ui". |

Padrão de `friendlyAIError` (VERIFIED: `src/lib/ai-errors.ts`):
- `rootCause`: se `RetryError` (SDK esgotou tentativas), pega o 429 de dentro de `error.errors` ou `error.lastError`.
- `isRateLimit`: `APICallError.statusCode === 429` ou mensagem com "rate limit".
- Diferencia **cota diária** (`/per day|TPD|RPD|daily/`) de limite por minuto. Para diária, não adianta esperar.
- 401 → "chave recusada". `APICallError` sem `statusCode` → "não deu para conectar" (rede/servidor local fora).
- Testes em `src/lib/__tests__/ai-errors.test.ts` (VERIFIED) usam `new APICallError({message, url, requestBodyValues, statusCode})` e `new RetryError({message, reason:'maxRetriesExceeded', errors:[...]})`.

Em `api/review/route.ts`: `NoObjectGeneratedError` / `NoOutputGeneratedError` → HTTP 502 "O modelo não devolveu um review válido"; 429 → 429; resto → 502 via `friendlyAIError`.

---

## 4. Structured output (generateText + Output.object + zod 4) (VERIFIED: `src/lib/review/review.ts`, `schema.ts`, `d.ts`)

Código real:

```ts
import { generateText, Output, type LanguageModel } from "ai";
import { DesignReview } from "./schema";

export async function runDesignReview(model: LanguageModel, files: Record<string, FileNode>): Promise<DesignReview> {
  const { output } = await generateText({
    model,
    instructions: reviewPrompt,               // system prompt no AI SDK 7 é `instructions`
    prompt: filesToPrompt(files),
    maxRetries: 6,
    output: Output.object({
      schema: DesignReview,                   // zod 4
      name: "design_review",
      description: "Structured design review of the generated UI",
    }),
  });
  return output;                              // já tipado e validado
}
```

- Assinatura VERIFIED: `declare function object<OUTPUT, SCHEMA>(options: ObjectOptions<...>): Output<...>`; `Output` é exportado como namespace (`output_d_exports as Output`).
- `generateText` é `generateText<TOOLS, RUNTIME_CONTEXT, OUTPUT>(options: GenerateTextOptions): Promise<GenerateTextResult>` (VERIFIED). `streamText` tem a mesma família de opções (`stopWhen`, `prepareStep`, `maxRetries`, `instructions`).
- `isStepCount(n)` existe e é exportado com esse nome (`export declare function isStepCount`) e também como alias `stepCountIs` (VERIFIED no `index.d.ts`).
- Schema zod (VERIFIED `schema.ts`): `ReviewRule` = `z.enum([...10 regras])`, `ReviewIssue` = `{id, title, file, severity: enum low|medium|high, rule, suggestion}`, `DesignReview` = `{score: number 0..100, summary, issues: ReviewIssue[]}`. Tipos com `z.infer`.
- Campos em PT-BR são instrução do prompt (`Write "summary", "title" and "suggestion" in Brazilian Portuguese.`).

Modo de falha:
- Se o modelo devolve JSON fora do schema, o SDK lança `NoObjectGeneratedError` (ou `NoOutputGeneratedError` quando não há saída). A rota converte em 502 com mensagem "tente de novo". Nada inválido chega à UI.
- Erros de rede/429 passam por `maxRetries` antes.
- Teste de contrato em `review/__tests__/schema.test.ts` (VERIFIED): aceita válido, rejeita score fora de 0..100, severity/rule desconhecidos e campo faltando.
- O mock responde `responseFormat.type === 'json'` com JSON pronto; o teste da rota faz `DesignReview.parse(json.review)`.

Ponto de atenção para modelos locais: `Output.object` pede JSON com schema ao provedor. Servidores locais variam em suporte a `response_format`. Teste antes de depender (ASSUMED).

---

## 5. Windows: scripts, node-compat.cjs e como o repo roda no Windows

### 5.1 Scripts (VERIFIED: `package.json`)
```json
"dev":        "NODE_OPTIONS='--require ./node-compat.cjs' next dev --turbopack",
"dev:debug":  "AI_DEBUG=1 NODE_OPTIONS='--require ./node-compat.cjs' next dev --turbopack",
"dev:daemon": "NODE_OPTIONS='--require ./node-compat.cjs' next dev --turbopack > logs.txt 2>&1 & echo ...",
"build":      "NODE_OPTIONS='--require ./node-compat.cjs' next build",
"start":      "NODE_OPTIONS='--require ./node-compat.cjs' next start",
"test:e2e:real": "E2E_PROVIDER=anthropic playwright test",
"test:e2e:groq": "E2E_PROVIDER=groq playwright test",
"docs:capture": "CAPTURE=1 playwright test e2e/capture-docs.spec.ts"
```

Problemas em Windows (ASSUMED, a partir do comportamento conhecido do npm no Windows: `script-shell` padrão é `cmd.exe`; NÃO testado nesta sessão):
- `VAR=valor comando` e `VAR='...' comando` não funcionam no `cmd.exe`. Também `&` e `>` têm sentido diferente.
- Quem roda `npm run dev` no PowerShell ou cmd quebra. Git Bash roda, porque é POSIX (por isso o repo funciona para quem usa Git Bash).
- Sinal de que o repo foi usado no Windows: existe `src/generated/prisma/query_engine-windows.dll.node` (VERIFIED: `ls`).
- Correção para o novo projeto: usar `cross-env` para variáveis (ASSUMED: nome do pacote conhecido, versão NÃO consultada com `npm view`), ou colocar `--require` em outro lugar. Para `NODE_OPTIONS`, `cross-env NODE_OPTIONS=--require=./node-compat.cjs next dev` (ASSUMED sintaxe, não testada). Alternativa melhor: **não precisar do shim** (ver 5.2).
- `dev:daemon` usa `& echo` e `> logs.txt`: não existe equivalente simples no cmd. Remover do novo projeto ou usar `Start-Process` (PowerShell).

### 5.2 `node-compat.cjs` (VERIFIED: arquivo lido; VERIFIED comportamento do Node nesta máquina)

Conteúdo, em essência:
```js
if (typeof globalThis !== "undefined" && typeof window === "undefined") {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
}
```
Motivo declarado: no Node 25+, `localStorage`/`sessionStorage` existem como globais experimentais (Web Storage). Sem `--localstorage-file` ficam não funcionais; algumas dependências no SSR detectam o global, assumem navegador e quebram com `localStorage.getItem is not a function`.

Teste feito nesta máquina (Node v26.13.0):
- `node -e "console.log(typeof localStorage)"` → `undefined`, com `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.`
- Com `--require node-compat.cjs` → `undefined`, sem o warning de acesso após o delete.
- Conclusão: no Node 26 o global existe mas está em estado não funcional e emite warning. O shim evita o warning e o uso acidental no SSR. **Recomendação**: manter o shim (ou equivalente) se o SSR do Next tocar em bibliotecas que checam `typeof localStorage`. Não testei o Next 16 sem o shim (ASSUMED que é seguro remover só se nenhum warning/erro aparecer no `next dev`). Opção mais limpa: pinar `engines` em Node 22 LTS (já pedido pelo repo: `"engines": {"node": ">=22"}`) ou testar sem o shim.

### 5.3 Como o repo roda no Windows
- Não há script `.ps1` nem `cross-env` no `package.json` (VERIFIED). Quem roda no Windows deve usar Git Bash ou WSL para os scripts atuais.
- `.gitignore` e `prisma/` estão no repo; Prisma precisa de `npx prisma generate` (script `setup`).
- Para o novo projeto: escrever os scripts já com `cross-env`/`tsx`, ou documentar "use Git Bash" explicitamente.

---

## 6. Testes (VERIFIED: arquivos lidos)

### 6.1 Vitest (`vitest.config.mts`, copiar quase igual)
```ts
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**', '_backup_pre_upgrade/**'],
  },
})
```
- Dependências dev: `vitest ^3.2.4` (instalado 3.2.7), `jsdom ^26.1.0`, `@testing-library/react ^16.3.0`, `@testing-library/dom ^10.4.0`, `@testing-library/user-event ^14.6.1`, `@vitejs/plugin-react ^4.5.2`, `vite-tsconfig-paths ^5.1.4`.
- Testes de rota usam `// @vitest-environment node` no topo do arquivo (VERIFIED em `api/chat/__tests__/route.test.ts`), porque o `Request`/`Response` e o stream precisam de ambiente Node.
- Padrão de mock para rotas (VERIFIED):
```ts
vi.mock("@/lib/prisma", () => ({ prisma: { project: { update: vi.fn() } } }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn(async () => null) }));
beforeEach(() => { process.env.AI_PROVIDER = "mock"; process.env.MOCK_TOKEN_DELAY_MS = "0"; });
```
- Leitura de stream SSE nos testes: `res.text()`, split por `\n`, filtra `data: `, ignora `[DONE]`, faz `JSON.parse`. Asserts sobre `type` das partes: `text-delta`, `tool-input-available`, `tool-output-available`, `finish` como último.
- Teste de "chave ausente" devolve 500 com a mensagem contendo o nome da variável (`/GROQ_API_KEY/`).

Testes de unidade que valem copiar: `provider.test.ts` (resolução), `ai-errors.test.ts`, `debug-fetch.test.ts` (`redactUrl`, `summarizeRequest`), `review/__tests__/schema.test.ts`.

### 6.2 Playwright (`playwright.config.ts`, VERIFIED)
- `testDir: "./e2e"`, `testIgnore` para `capture-*.spec.ts` salvo com `CAPTURE`.
- Porta por provedor: mock → `3100`; real → `3200`. `baseURL` = `http://localhost:${port}`.
- **Como o e2e força o mock**: `E2E_PROVIDER` (default `mock`) vira `webServer.env.AI_PROVIDER = provider`. Playwright sobe `npm run dev -- --port ${port}` com essa env. `reuseExistingServer: !process.env.CI`.
- `MOCK_TOKEN_DELAY_MS` default `"12"` no e2e.
- Timeouts: mock 90 s / expect 20 s; real 420 s / 300 s. `workers: 1`, `fullyParallel: false`, `retries: CI ? 1 : 0`.
- `devices['Desktop Chrome']`, viewport 1440x900, `trace: 'retain-on-failure'`.
- Playwright `^1.65.1`.

Spec `e2e/generate-and-review.spec.ts` (VERIFIED): observa tokens via `MutationObserver` em `page.addInitScript` (classe `.token-in`), clica num prompt de exemplo, espera `tool-step`, `done`, preview em `iframe[title="Preview"]`, aba Código, `review-button` → `review-panel`/`review-summary`/`review-issue` (3 no mock), botão JSON, e valida com `DesignReview.parse`. O mock é determinístico, então o e2e assere texto exato ("O café").

Para o vitrine-studio: o e2e deve assertar o JSON A2UI resultante (ou o render) em vez de texto de tela, e usar o mock A2UI da seção 2.4.

Obs.: `npm run test:e2e:real` usa `E2E_PROVIDER=anthropic` no comando (sintaxe POSIX, ver 5.1).

---

## 7. Lista de arquivos: portar quase igual vs. reescrever

**Portar quase igual (copiar com mudanças mínimas de nomes/comentários):**
- `src/lib/ai-errors.ts`: funções `rootCause`, `isRateLimit`, `friendlyAIError`. Trocar textos específicos do Groq e incluir mensagem para servidor local.
- `src/lib/debug-fetch.ts`: wrapper de `fetch` com log e gravação em `logs/ai/`; `redactUrl`, `summarizeRequest`. Funciona para qualquer provedor que aceite `fetch`. Atenção: grava o corpo da requisição (prompt inteiro) em disco; manter sob flag e fora do git.
- `src/lib/__tests__/ai-errors.test.ts`, `debug-fetch.test.ts`, `provider.test.ts` (adaptar nomes de provedores).
- `vitest.config.mts`, `playwright.config.ts` (trocar porta/nomes).
- `src/lib/review/schema.ts` e `review/review.ts` (se o vitrine-studio tiver um "reimaginar com IA" com saída estruturada; o schema vira o schema A2UI ou o schema de 'proposta de landing').
- `src/lib/tools/file-manager.ts` só se o projeto usar arquivos virtuais (provavelmente não no A2UI).

**Adaptar (mesma forma, conteúdo diferente):**
- `src/lib/provider.ts`: manter `resolveProvider`, `DEFAULT_MODELS`, `getModelConfig`, `getActiveModelInfo`. Adicionar provedor local, override por request, e não exigir chave para local.
- `src/lib/mock-model.ts`: manter a classe e o `streamText`/`finish`/`usage`; trocar a geração de texto/tool-call por JSON A2UI determinístico (seção 2.4).
- `src/app/api/chat/route.ts`: manter `streamText` + `toUIMessageStream` + `createUIMessageStreamResponse`, `prepareStep` forçando a 1ª tool, `maxRetries`, `onError: friendlyAIError`. Trocar as tools por tools de A2UI.
- `src/app/api/review/route.ts`: manter o padrão de status (400/500/502/429). Trocar "review" por "reimaginar" ou "gerar backend a partir da arquitetura".
- `src/lib/tools/str-replace.ts`: manter o padrão `withSyntaxCheck` (validar na própria tool e devolver erro acionável). Trocar Babel por validação zod/JSON.
- `src/lib/review/review.ts`: manter `Output.object` + `generateText`.
- `src/lib/prompts/generation.tsx`: reescrever. Manter a estrutura (papel, regras numeradas, "responda por tool", "fale na língua do usuário").
- `src/lib/contexts/chat-context.tsx`: manter `useChat` + `DefaultChatTransport({api})`, `onToolCall`, `sendMessage(text, {body})`. Adicionar `model` no body.
- `node-compat.cjs`: manter só se o Node do time for 25+ e o `next dev` mostrar problema; caso contrário, descartar.

**Reescrever (específico da UI do Vitrine atual):**
- `src/lib/file-system.ts`, `src/lib/transform/jsx-transformer.ts`, `src/components/preview/PreviewFrame.tsx`, `src/components/editor/*`, `src/lib/contexts/file-system-context.tsx`: o modelo é de arquivos JSX; o vitrine-studio é canvas + JSON A2UI + backends/DB. Não reaproveitar.
- Prisma/auth (`src/lib/auth.ts`, `prisma.ts`, `proxy.ts`): só se o projeto persistir; fora do escopo deste tópico.
- `src/lib/legacy-messages.ts`: não se aplica a greenfield.

---

## 8. Riscos e pendências

- **VERIFIED**: `ai` 7.0.173 usa `@ai-sdk/provider` 4.0.38 (V4). Pacotes de provedor de 4.x e `@ai-sdk/openai-compatible` 3.0.92 também são V4. Misturar majors do número sem checar a spec é o erro mais provável.
- **ASSUMED**: a base URL padrão do LM Studio (`1234`) e o default da baseURL do `ollama-ai-provider-v2`. Confirmar.
- **ASSUMED**: `retry-after` do SDK em 429. Confirmar lendo o retry do `ai` antes de depender.
- **NÃO FEITO**: não li a spec A2UI (https://a2ui.org/), fora do escopo deste tópico; não testei `ollama`/`lmstudio` reais (Ollama não está instalado); não rodei `next dev` com e sem `node-compat.cjs`; não consultei `npm view cross-env`.
- **NÃO FEITO**: não li as páginas "Tool Use" e "Structured Output" do LM Studio, necessárias para saber se modelos locais dele suportam tools e `response_format`.

## 9. Arquivos lidos (referência)

Repo (somente leitura): `src/lib/provider.ts`, `mock-model.ts`, `ai-errors.ts`, `debug-fetch.ts`, `review/review.ts`, `review/schema.ts`, `tools/str-replace.ts`, `tools/file-manager.ts`, `prompts/generation.tsx`, `contexts/chat-context.tsx`, `app/api/chat/route.ts`, `app/api/review/route.ts`, testes em `src/lib/__tests__/`, `src/lib/review/__tests__/`, `src/app/api/*/__tests__/`, `e2e/*.ts`, `vitest.config.mts`, `playwright.config.ts`, `next.config.ts`, `node-compat.cjs`, `package.json`, `AGENTS.md`, `CLAUDE.md`, `.env` (só nomes), `tsconfig.json`, `.github/workflows/agent-loop.yml` (só o cabeçalho).

Pacotes verificados (tarballs em `<scratchpad>/pkgcheck/`): `ai-sdk-openai-compatible-3.0.92.tgz`, `ai-sdk-openai-4.0.118.tgz`, `ollama-ai-provider-v2-4.1.0.tgz`.

Fontes web: https://ollama.com/blog/openai-compatibility (VERIFIED base URL `http://localhost:11434/v1`), https://lmstudio.ai/docs/developer/openai-compat (VERIFIED exemplo `http://localhost:1234/v1` e lista de endpoints).
