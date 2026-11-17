# Local AI on top of Vercel AI SDK 7 (vitrine-studio)

Date of research: 2026-11-17. Scope: providers for Ollama, LM Studio, llama.cpp and any OpenAI-compatible endpoint, structured output, model choice, CORS, in-browser options, and a provider-registry design.

Legend: **VERIFIED (how)** = checked against npm registry, installed package .d.ts or source, a live web page, or a probe run. **ASSUMED** = not checked, or recalled from memory.

---

## 0. Summary

- `ai@7.0.173` is `latest` (VERIFIED `npm view ai dist-tags`). Its dependencies are `@ai-sdk/provider@4.0.38`, `@ai-sdk/provider-utils@5.0.81`, `@ai-sdk/gateway@4.0.146`, and peer `zod ^3.25.76 || ^4.1.8` (VERIFIED `npm view ai@7.0.173 dependencies peerDependencies`).
- The reference repo pins `ai ^7.0.173` and `@ai-sdk/provider ^4.0.38` (VERIFIED, `vitrine-ia/package.json`), so it matches the current latest line.
- Every provider probed below instantiates a language model with `specificationVersion: "v4"` (LanguageModelV4) against `ai@7.0.173`, and the probe type-checks under `tsc --strict` with exit 0 (VERIFIED, see section 1.3).
- **Recommended stack for local AI:**
  1. **`@ai-sdk/openai-compatible@3.0.92`** for LM Studio, llama.cpp, vLLM, and any OpenAI-compatible server. Set `supportsStructuredOutputs: true` explicitly (the default is `false`, see section 2).
  2. **`ollama-ai-provider-v2@4.1.0`** for Ollama, native `/api/chat`, which lets you pass `num_ctx` and a JSON schema in `format`. It is a peer of `ai ^7.0.0` and `zod ^4.0.16`.
  3. **`ai-sdk-ollama@4.6.3`** is the alternative for Ollama. It is richer (embeddings, reranking, tool-calling and object-generation "reliability" layers, `structuredOutputs` flag), but it is heavier and more opinionated. Requires `ai ^7.0.137`.
  4. Avoid `ollama-ai-provider` (v1, `latest` 1.2.0, last published 2025-01-17, peer `zod ^3`). It is stale and not v7-compatible (VERIFIED `npm view`).
  5. `@lmstudio/sdk@2.1.0` (VERIFIED `npm view`, modified 2026-10-14) is the LM Studio native SDK. It is **not** an AI SDK provider. Prefer the OpenAI-compatible route for uniformity.
- **Ollama context pitfall (VERIFIED, Ollama FAQ):** default context window is **4096 tokens**. Prompts that include a large canvas/JSON schema will be silently truncated. Set `options.num_ctx` per request, or `OLLAMA_CONTEXT_LENGTH` server-wide.
- **Model recommendations:** only the `qwen2.5-coder` tag sizes are VERIFIED. Nov 2026 model recommendations are **ASSUMED** and need a re-check at implementation time (section 3).

---

## 1. Provider packages (npm + probe)

### 1.1 Registry facts (VERIFIED `npm view`, 2026-11-17)

| Package | Latest | Last modified | Peer / key deps | Compatible with ai@7 / v4? |
|---|---|---|---|---|
| `ai` | 7.0.173 | 2026-11-13 | peer `zod ^3.25.76 \|\| ^4.1.8`; dep `@ai-sdk/provider 4.0.38` | n/a (core) |
| `@ai-sdk/provider` | 4.0.38 | 2026-11-12 | none | yes (LanguageModelV4) |
| `@ai-sdk/openai-compatible` | 3.0.92 | 2026-11-13 | dep `@ai-sdk/provider 4.0.38`, `@ai-sdk/provider-utils 5.0.81`; peer zod | **yes** (VERIFIED probe: `specificationVersion v4`) |
| `@ai-sdk/openai` | 4.0.118 | 2026-11-13 | peer zod | **yes** (VERIFIED probe) |
| `@ai-sdk/anthropic` | 4.0.105 | 2026-11-13 | peer zod | yes (not probed) |
| `@ai-sdk/google` | 4.0.121 | 2026-11-13 | peer zod | yes (not probed) |
| `@ai-sdk/groq` | 4.0.84 | 2026-11-13 | peer zod | yes (not probed) |
| `ollama-ai-provider-v2` | 4.1.0 | 2026-10-22 | dep `@ai-sdk/provider ^4.0.21`, `@ai-sdk/provider-utils ^5.0.53`; **peer `ai ^7.0.0`, `zod ^4.0.16`** | **yes** (VERIFIED probe) |
| `ai-sdk-ollama` | 4.6.3 | 2026-11-05 | dep `ollama ^0.6.4`, `jsonrepair`, `@ai-sdk/provider ^4.0.34`; **peer `ai ^7.0.137`** | **yes** (VERIFIED probe) |
| `ollama-ai-provider` (v1) | 1.2.0 | 2025-01-17 | peer `zod ^3.0.0` | **no**: stale, v1 spec |
| `ollama` (ollama-js) | 0.6.4 | — | — | used by ai-sdk-ollama |
| `@lmstudio/sdk` | 2.1.0 | 2026-10-14 | — | not an AI SDK provider |
| `@mlc-ai/web-llm` | 0.2.89 | 2026-11-17 | — | in-browser runtime (section 5) |
| `@browser-ai/web-llm` | 3.0.4 | 2026-10-01 | — | AI SDK provider wrapping WebLLM (VERIFIED version; not probed) |
| `@huggingface/transformers` | 4.3.2 | 2026-10-30 | — | in-browser runtime (section 5) |

### 1.2 Probe setup (VERIFIED)

Location: `<scratchpad>/localai-probe`

Installed (`npm install ai@7.0.173 @ai-sdk/openai-compatible@3.0.92 @ai-sdk/openai@4.0.118 ollama-ai-provider-v2@4.1.0 ai-sdk-ollama@4.6.3 typescript@5 @types/node`). `npm ls` resolved `@ai-sdk/provider@4.0.38` and `zod@4.6.7` as a single copy.

Probe file `probe.ts` (abbreviated):

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { createOllama as createOllamaSdk } from 'ai-sdk-ollama';
import { generateText, Output, jsonSchema } from 'ai';

const oc = createOpenAICompatible({ name: 'lmstudio', baseURL: 'http://localhost:1234/v1' });
const oa = createOpenAI({ baseURL: 'http://localhost:1234/v1', apiKey: 'x' });
const ol = createOllama({ baseURL: 'http://localhost:11434/api' });
const ol2 = createOllamaSdk({ baseURL: 'http://localhost:11434' });
// oc('qwen2.5-coder'), oa.chat('qwen2.5-coder'), ol('qwen2.5-coder:7b'), ol2('qwen2.5-coder:7b')
```

Observed output (VERIFIED, run with `tsx`):

```
openai-compatible      specificationVersion= v4 provider= lmstudio.chat    modelId= qwen2.5-coder
openai(baseURL)        specificationVersion= v4 provider= openai.chat      modelId= qwen2.5-coder
ollama-ai-provider-v2  specificationVersion= v4 provider= ollama.responses modelId= qwen2.5-coder:7b
ai-sdk-ollama          specificationVersion= v4 provider= ollama           modelId= qwen2.5-coder:7b
Output.object exists: function
jsonSchema exists: function
openai-compatible call error: Failed after 3 attempts. Last error: AI_APICallError: Cannot connect to API:
ollama-v2 call error: Failed after 3 attempts. Last error: AI_APICallError: Cannot connect to API:
ai-sdk-ollama call error: fetch failed
```

Type check: `tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 --skipLibCheck probe.ts` gave exit 0 (VERIFIED).

Note: `@ai-sdk/openai` defaults to the Responses API. Use `.chat(modelId)` to hit `/v1/chat/completions` on local servers (VERIFIED: provider name `openai.chat`).

### 1.3 Which provider for which backend

| Backend | Recommended package | Base URL | Notes |
|---|---|---|---|
| (a) Ollama | `ollama-ai-provider-v2@4.1.0` (primary) or `ai-sdk-ollama@4.6.3` | `http://localhost:11434/api` (v2), `http://localhost:11434` (ai-sdk-ollama) | v2 uses native `/api/chat`. Its base URL includes `/api` (VERIFIED: paths are `/chat`, `/generate` appended to config URL). |
| (b) LM Studio | `@ai-sdk/openai-compatible@3.0.92` | `http://localhost:1234/v1` | Port 1234 VERIFIED (LM Studio docs). |
| (c) llama.cpp `llama-server` | `@ai-sdk/openai-compatible@3.0.92` | `http://127.0.0.1:9931/v1` | Default port 9931 VERIFIED (llama.cpp server README). `/v1/chat/completions` path is ASSUMED (standard for llama-server). |
| (d) Any OpenAI-compatible (vLLM, LocalAI, etc.) | `@ai-sdk/openai-compatible@3.0.92` | user-provided `/v1` | Set `name` and `supportsStructuredOutputs` per backend. |

Setup snippets (ASSUMED to behave as shown at runtime; construction and types are VERIFIED):

```ts
// LM Studio / llama.cpp / any OpenAI-compatible
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const lmstudio = createOpenAICompatible({
  name: 'lmstudio',
  baseURL: 'http://localhost:1234/v1',
  supportsStructuredOutputs: true, // REQUIRED for json_schema, see section 2
});
const model = lmstudio('qwen2.5-coder-7b-instruct'); // model id as shown by LM Studio
```

```ts
// Ollama, native API
import { createOllama } from 'ollama-ai-provider-v2';
import { generateText, Output } from 'ai';

const ollama = createOllama({ baseURL: 'http://localhost:11434/api' });
const { output } = await generateText({
  model: ollama('qwen2.5-coder:7b'),
  output: Output.object({ schema: mySchema }),
  providerOptions: { ollama: { options: { num_ctx: 8192 } } },
});
```

`providerOptions` key `ollama` is VERIFIED from source (`parseProviderOptions` uses `provider: "ollama"`). Whether `Output.object` passes the schema through as `format` at runtime is ASSUMED (the source maps `responseFormat.type === "json"` with a `schema` to `format: schema`, VERIFIED in `dist/index.js`). Confirm with a live call before relying on it.

### 1.4 Notes on each package

- **`@ai-sdk/openai-compatible@3.0.92`**: VERIFIED d.ts. Options include `supportsStructuredOutputs`, `supportsMultiPartToolContent`, `transformRequestBody`, `includeUsage`, `metadataExtractor`, `errorStructure`. The provider merges `providerOptions[name]` into the request body. This is the right escape hatch for server-specific fields (for example LM Studio's `ttl` or llama.cpp's `cache_prompt`, not verified).
- **`ollama-ai-provider-v2@4.1.0`**: VERIFIED d.ts. Provider options `think` (boolean) and `options` (`num_ctx`, `repeat_last_n`, `repeat_penalty`, `temperature`, `seed`, `stop`, `num_predict`, `top_k`, `top_p`, `min_p`). Settings `compatibility: 'strict' | 'compatible'`, `headers`, `fetch`. Its completion model warns that `responseFormat` is unsupported (`dist/index.js` line ~392).
- **`ai-sdk-ollama@4.6.3`**: VERIFIED d.ts. Chat settings: `options` (Ollama params), `keep_alive`, `format`, `think`, `tools`, `structuredOutputs`, `reliableToolCalling` (default true with function tools), `toolCallingOptions`, `reliableObjectGeneration` (default true with JSON schemas), `objectGenerationOptions` (`maxRetries` default 3, `attemptRecovery`, `useFallbacks`, `fixTypeMismatches`, `enableTextRepair`). It also re-exports `generateText`, `streamText`, `ToolLoopAgent`, and reranking/embedding/speech models. It is more powerful, but the retry and repair layers can mask model failures. Prefer it if you want automatic repair; prefer v2 for a thin, predictable layer.

---

## 2. Structured output on local servers

### 2.1 What each server accepts (VERIFIED unless noted)

| Server | Mechanism | Request shape |
|---|---|---|
| **Ollama native** `/api/chat` | `format` = JSON schema object (or `"json"`) | `{"model":"...","messages":[...],"format":{"type":"object","properties":{...},"required":[...]}}`. Python: `format=Country.model_json_schema()`. JS: `format: z.toJSONSchema(Country)` (VERIFIED, docs.ollama.com/capabilities/structured-outputs). |
| **Ollama OpenAI-compat** | `response_format` | Docs say structured outputs work via `response_format`, with no example (VERIFIED, same page). |
| **LM Studio** | OpenAI `response_format` with `json_schema` | `{"type":"json_schema","json_schema":{"name":"...","strict":true,"schema":{...}}}`. The docs example writes `strict` as the string `"true"`. Use a boolean. Docs warn that not all models support structured output, especially under 7B. Check the model card (VERIFIED, lmstudio.ai/docs/developer/openai-compat/structured-output). |
| **llama.cpp `llama-server`** | Server flag `-j/--json-schema SCHEMA` (grammar-constrained sampling). Per-request `json_schema` on `/completion`. | Chat `response_format` with `json_schema` is ASSUMED (not shown on the fetched README). Verify with the actual server build. (VERIFIED for the flags, README.) |
| **OpenAI-compatible generic** | `response_format` | Same as above. Depends on the server. |

### 2.2 How AI SDK 7 maps onto this

- `@ai-sdk/openai-compatible` (VERIFIED source, `dist/index.js` ~line 519):
  - If `responseFormat.type === "json"` **and** `responseFormat.schema != null` **and** `supportsStructuredOutputs === true` → sends `response_format: { type: "json_schema", json_schema: { schema, strict, name, description } }`.
  - Otherwise → sends `response_format: { type: "json_object" }` with **no schema**, and adds a warning (VERIFIED line ~495).
  - `strict` defaults to `true` (`strictJsonSchema`, provider option).
  - **Consequence:** with the default `supportsStructuredOutputs: false`, LM Studio and llama.cpp return unconstrained JSON. Always set it to `true` when the backend supports `json_schema`.
- `ollama-ai-provider-v2` (VERIFIED source): `responseFormat.type === "json"` → `format: responseFormat.schema ?? "json"`. No extra flag needed.
- `ai-sdk-ollama`: explicit `structuredOutputs` and `format` settings, plus `reliableObjectGeneration` (retries and repair).
- The AI SDK 7 entry point is `Output.object({ schema })` (VERIFIED: `Output` and `jsonSchema` exist in `ai@7.0.173`). Its `object` helper is also in the `ai` d.ts (VERIFIED `declare function object`).

### 2.3 Tool calling per popular local model

Not verified in this research pass (no time to test models). ASSUMED general pattern:

- Ollama: tool calling is supported on many instruct models (Qwen2.5 family, Llama 3.x, Mistral family). Use it via `tools` on `/api/chat`. Check `capabilities` in `/api/show`.
- LM Studio: tool use via the OpenAI `tools` field, for models whose template supports it.
- llama.cpp: tool calling depends on the chat template and `--jinja` (default enabled, VERIFIED from README). Whether it requires `--jinja` for tools is not confirmed.

**Recommendation:** for the product's core outputs (a JSON layout or an architecture graph), use `Output.object` with a schema, not tool calling. It is more portable across local servers.

---

## 3. Recommended local models (Nov 2026)

Verified facts:
- Ollama library page for `qwen2.5-coder` (VERIFIED fetched 2026-11-17): tags `latest` 4.7GB, `0.5b` 398MB, `1.5b` 986MB, `3b` 1.9GB, `7b` 4.7GB, `14b` 9.0GB, `32b` 20GB (all Q4_K_M by digest match). Also `7b-instruct-q8_0` 8.1GB, `7b-instruct-fp16` 15GB, `32b-instruct-q2_K` 12GB. The page's newest entries were marked "1 year ago", and it showed no newer Qwen coder or Qwen3 instruct tags. That suggests the page snapshot is stale, or the tags moved elsewhere. Re-check `https://ollama.com/library` before pinning.

Hardware tiers. Tags below are VERIFIED to exist **on the fetched page** only. Whether they are the best choice in Nov 2026 is **ASSUMED**.

| VRAM / RAM tier | Suggested tag (VERIFIED exists) | Size on disk | Notes |
|---|---|---|---|
| 8 GB | `qwen2.5-coder:7b` | 4.7 GB | Fits with room for KV cache at 8K context (ASSUMED). |
| 16 GB | `qwen2.5-coder:14b` | 9.0 GB | Good balance for JSON/UI. (ASSUMED.) |
| 24 GB | `qwen2.5-coder:32b` | 20 GB | Tight with long context on 24 GB (ASSUMED). Use `num_ctx` 8192 or lower. |

Speed and realistic context limits: **ASSUMED**, not measured. Expect ~10–30 tok/s on 8 GB GPUs at 7B Q4 and much lower on CPU-only. Measure on the target machine before committing.

Action item: at implementation time, run `ollama list` / `ollama show <tag>` and check the `ollama.com/library` page for newer instruct or coder models with tool or JSON capability before pinning defaults. Make the model id configurable (section 6), never hard-code it.

---

## 4. Ollama context, CORS and discovery

### 4.1 Context length (VERIFIED, Ollama FAQ, `docs/faq.mdx` on GitHub)

- Default: **4096 tokens**. Quote: "By default, Ollama uses a context window size of 4096 tokens."
- Server-wide: `OLLAMA_CONTEXT_LENGTH=8192 ollama serve`.
- Per request: pass `num_ctx` inside `options`. With the native API: `"options": {"num_ctx": 8192}`. With `ollama-ai-provider-v2`: `providerOptions: { ollama: { options: { num_ctx: 8192 } } }`.
- **Pitfall:** truncation is silent. The prompt's start is dropped, so the system prompt and schema can disappear. Always set `num_ctx` explicitly on every call to a local model, and log the number of prompt tokens.

### 4.2 CORS (VERIFIED, Ollama FAQ)

- By default Ollama allows cross-origin requests from `127.0.0.1` and `0.0.0.0`. The fetched page does not mention `localhost` as a default origin. Treat a browser page at `http://localhost:3000` calling `http://localhost:11434` as **ASSUMED to need** `OLLAMA_ORIGINS`.
- Add origins with `OLLAMA_ORIGINS`, for example `OLLAMA_ORIGINS=http://localhost:3000 ollama serve`. Browser extension patterns are `chrome-extension://*`, `moz-extension://*`, `safari-web-extension://*`.
- **Recommendation:** call Ollama from a **server route** (Next.js route handler) so no CORS is needed. Only expose the browser direct-call path as an opt-in.

### 4.3 Discovery endpoints

- **`GET http://localhost:11434/api/tags`** (VERIFIED, docs.ollama.com/api/tags). Response: `{ "models": [ { "name", "model", "remote_model?", "remote_host?", "modified_at" (ISO 8601), "size" (bytes), "digest", "details": { "format", "family", "families", "parameter_size", "quantization_level" } } ] }`. Use this for the model picker and for health-checking.
- **`GET http://localhost:11434/v1/models`** (ASSUMED): not documented on the fetched Ollama page. Check it with `curl` before relying on it. The OpenAI-compatible path is for a generic OpenAI client, so `/api/tags` is the recommended discovery call for Ollama.
- **LM Studio** `GET http://localhost:1234/v1/models` (ASSUMED, the OpenAI-compatible list endpoint). The fetched docs did not confirm it.
- **llama.cpp** `GET http://127.0.0.1:9931/v1/models` (ASSUMED; the README mentions `/models` or `/v1/models` for capability checks, VERIFIED in passing). Response shape not shown.
- **Health checks:** Ollama `GET /api/tags`. llama.cpp `GET /health` (VERIFIED, public, skips the API key check).

Browser-side discovery for a model picker should go through the server route (`/api/models?kind=ollama`), not directly from the browser, for the same CORS reasons.

---

## 5. In-browser options (status Nov 2026)

- **WebLLM (`@mlc-ai/web-llm`)**: latest `0.2.89`, modified 2026-11-17 (VERIFIED `npm view`). Runs quantized models in WebGPU. Requires a WebGPU-capable browser and a multi-GB model download. Search results gave conflicting versions, but `npm view` is authoritative.
- **`@browser-ai/web-llm`** `3.0.4` (modified 2026-10-01, VERIFIED `npm view`) is a Vercel AI SDK provider wrapping WebLLM. Its ai-sdk compatibility is **ASSUMED** (not probed). Its `@browser-ai/core` depended on at `3.0.4` was seen in the probe install tree (VERIFIED). Check its peer range before adopting.
- **Transformers.js (`@huggingface/transformers`)** `4.3.2` (modified 2026-10-30, VERIFIED). Runs ONNX models in browser (WebGPU or WASM). Good for small models, embeddings, and classifiers. Not a reliable path for a 7B+ structured-output generator. ASSUMED.
- **Chrome built-in Prompt API** (`LanguageModel`): the docs at `developer.chrome.com/docs/ai/prompt-api` say to call `LanguageModel.availability()`. Gemini Nano downloads once per origin. Hardware: GPU path needs more than 4 GB VRAM; CPU path needs 16 GB RAM and 4+ cores. Status table snippet shows Chrome 148 for web, Chrome 138 for extensions, and an origin trial for sampling parameters. This is partial (VERIFIED: search snippet and docs, not the live page). The status is not settled. Treat it as **experimental and Chrome-only**. No AI SDK provider is verified for it.

**Verdict:** an in-browser mode is realistic only as an **optional third mode**, with a clear "not available here" fallback. Use WebLLM for a larger model. Use Prompt API as a zero-download bonus where available. Do not make it the default. Quality for structured UI JSON is ASSUMED to be lower than on local Ollama with 7B+ models.

---

## 6. Proposed provider-registry design

### 6.1 Config type

```ts
// src/lib/ai/provider-config.ts
export type ProviderKind =
  | 'mock'
  | 'anthropic'
  | 'google'
  | 'groq'
  | 'openrouter'
  | 'openai-compatible'
  | 'ollama';

export interface ProviderConfig {
  kind: ProviderKind;
  model: string;          // e.g. 'qwen2.5-coder:7b' or 'claude-...'
  baseURL?: string;       // only for openai-compatible and ollama (and openrouter override)
  apiKey?: string;        // cloud providers and openai-compatible when the server needs one
}
```

### 6.2 Resolution (server only)

```ts
// src/lib/ai/resolve-model.ts  (server-side only, never imported by client code)
import 'server-only';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import type { ProviderConfig } from './provider-config';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveModel(cfg: ProviderConfig, opts: { allowRemoteBaseURL: boolean }): LanguageModel {
  switch (cfg.kind) {
    case 'ollama': {
      const base = assertBaseURL(cfg.baseURL ?? 'http://localhost:11434/api', opts);
      return createOllama({ baseURL: base })(cfg.model);
    }
    case 'openai-compatible': {
      const base = assertBaseURL(cfg.baseURL ?? 'http://localhost:1234/v1', opts);
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: base,
        apiKey: cfg.apiKey,
        supportsStructuredOutputs: true,
      }).chatModel(cfg.model);
    }
    // 'anthropic' | 'google' | 'groq' | 'openrouter' | 'mock': use the matching @ai-sdk/* package
    default:
      throw new Error(`provider kind not wired yet: ${cfg.kind}`);
  }
}

function assertBaseURL(raw: string, opts: { allowRemoteBaseURL: boolean }): string {
  const u = new URL(raw);                          // throws on junk
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad scheme');
  if (!opts.allowRemoteBaseURL && !LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(`baseURL host not allowed: ${u.hostname}`);
  }
  return raw;
}
```

Notes (ASSUMED names and behavior, the packages are VERIFIED):
- `createOpenAICompatible(...).chatModel(id)` is the named-method form. The probe used callable `oc('id')`, which also works (VERIFIED). Confirm the method name against the d.ts at implementation time.
- `server-only` is a Next.js convention (ASSUMED present in the reference repo).

### 6.3 Layering

1. **Defaults from `.env`** (server): `AI_PROVIDER=ollama`, `AI_MODEL=qwen2.5-coder:7b`, `AI_BASE_URL=http://localhost:11434/api`, plus per-provider keys (`ANTHROPIC_API_KEY`, etc.). Read on the server only.
2. **Per-request override** from the settings dialog: the browser sends a `ProviderConfig` in the request body. Keys live in the browser only (`localStorage` or `sessionStorage`, with try/catch) and are sent per request over HTTPS. Never persist them server-side and never log them.
3. The server merges: `request.provider ?? env defaults`. Validate with a schema (zod) before resolving.

### 6.4 Security caveats

- **SSRF:** a user-supplied `baseURL` on a deployed server lets any visitor make your server fetch arbitrary internal URLs (for example cloud metadata at `169.254.169.254`, or private LAN services). Default to **localhost only** (`allowRemoteBaseURL: false`). Enable remote hosts only by env flag, with an allowlist of hostnames, and only in trusted deployments.
- **Restrict `kind` for public deployments** to the cloud providers that use the operator's own key. Allow a user-supplied key only in local/dev mode, or pass the user's key through only for that request.
- **Keys:** a browser-stored key is visible to any script on the origin and to anyone at the machine. Treat it as a convenience for personal use, not a secret store.
- **llama.cpp default CORS is `*`** (VERIFIED: `--cors-origins` defaults to `*`). If the server is exposed to a network, bind `--host 127.0.0.1` and set `--api-key`/`LLAMA_API_KEY`. Calls from the server route avoid browser CORS altogether.
- **Ollama:** do not set `OLLAMA_ORIGINS=*` on a shared machine. Use specific origins.
- **Prompt injection through canvas content:** the reimagine input is user-authored, so treat it as untrusted. Validate the model's output with the schema before rendering it into A2UI.

### 6.5 Recommended defaults

- Local-first: `ollama` with `ollama-ai-provider-v2`, `num_ctx` 8192, model from `AI_MODEL`.
- Second: `openai-compatible` against LM Studio at `http://localhost:1234/v1` with `supportsStructuredOutputs: true`.
- Dev/offline: `mock`.
- In-browser mode: optional, later, section 5.

---

## 7. Open items (not verified in this pass)

1. Runtime behavior of `Output.object` through `ollama-ai-provider-v2` against a live Ollama (needs a server, not installed on this machine).
2. `/v1/models` on Ollama, LM Studio and llama.cpp (ASSUMED).
3. llama.cpp chat `response_format` json_schema shape (not verified from the README).
4. Current recommended local models for Nov 2026, with speed and context measurements.
5. `@browser-ai/web-llm` ai-sdk compatibility (not probed).
6. Chrome Prompt API current stable status (the live page was not read in full).

## 8. Sources

- npm registry: `npm view` for all packages listed in section 1.1 (2026-11-17).
- Installed .d.ts and source: `<scratchpad>/localai-probe/node_modules/`.
- Ollama FAQ (context, CORS): https://github.com/ollama/ollama/blob/main/docs/faq.mdx
- Ollama structured outputs: https://docs.ollama.com/capabilities/structured-outputs
- Ollama tags API: https://docs.ollama.com/api/tags
- Ollama library, qwen2.5-coder tags: https://ollama.com/library/qwen2.5-coder/tags
- LM Studio structured output: https://lmstudio.ai/docs/developer/openai-compat/structured-output
- llama.cpp server README: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- Chrome Prompt API: https://developer.chrome.com/docs/ai/prompt-api
- WebLLM: npm `@mlc-ai/web-llm` 0.2.89
