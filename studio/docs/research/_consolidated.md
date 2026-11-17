# vitrine-studio: consolidated facts sheet (2026-11-17)

Author: completeness critic. Backs: reports in this folder (abbrev. SPEC=a2ui-spec, REACT=a2ui-react, AGENT=a2ui-agent-side, LOCAL=local-ai, CANVAS=canvas-libs, CORE=vitrine-ai-core, UX=vitrine-ux, CODEGEN=codegen-backend-db) plus 7 NEW verifications run by the critic (marked CV1..CV7, details in section 9).
Legend: PROVEN = executed today (test/build/script). VERIFIED = read from registry/primary source. ASSUMED = not checked.
Probe dirs (scratchpad): a2ui-probe, agentprobe2, integration-probe (new, full stack incl. Next 16 build), localai-probe, canvas-probe.

## 0. Decisions in one screen

1. Protocol: A2UI **v1.0** wire format (`"version":"1.0"`, `@path`/`@call`). PROVEN renderable today (CV1). REACT's "v1.0 not supported" is WRONG for the real path, see 1.
2. Pipeline: LLM (Express DSL) -> `@a2ui/agent` (compile+validate) -> v1.0 JSON messages -> `@a2ui/web_core/v1_0` `MessageProcessor` -> `<A2uiSurface>` from `@a2ui/react`. All four PROVEN together except the LLM (CV1, CV2, CV3).
3. One source of truth for custom components: a zod `ComponentApi` object feeds BOTH the agent prompt/validation (`new CatalogConfig(catalog)`) and the React implementation (`createComponentImplementation`). PROVEN (CV2, CV1b).
4. Local AI: `ollama-ai-provider-v2` for Ollama (native, can set `num_ctx`), `@ai-sdk/openai-compatible` with `supportsStructuredOutputs: true` for LM Studio/llama.cpp/vLLM/any. Wire shapes PROVEN against a mock server (CV4).
5. zod: root `zod@3.25.76` + npm `overrides` (CV5). App-level schemas use `import {z} from 'zod/v4'` (ships inside 3.25.76, PROVEN). A2UI component APIs use plain `zod` (v3).
6. Canvases: React Flow (`@xyflow/react`) for architecture + ER; a custom tree editor with `@dnd-kit/react` for the UI canvas. Nested sortable NOT yet proven (spike first).
7. Codegen: deterministic emitters; LLM only emits zod-validated IR JSON. Hono template default.
8. Persistence v1: local-first (IndexedDB + versioned JSON file). Server only for AI routes.

## 1. Contradictions found and how each was resolved

| # | Contradiction | Resolution (evidence) |
|---|---|---|
| C1 | SPEC/AGENT say v1.0 is current; REACT says `@a2ui/react@0.15.0` cannot render v1.0 and recommends pinning v0.9. | **v1.0 DOES render.** `@a2ui/web_core@0.15.0` exports `./v1_0` with its own `MessageProcessor`, `Catalog`, `CommonSchemas`, `basicCatalog` (v1 basic catalog implemented as custom elements). The React `A2uiSurface` renders a surface created by that v1.0 processor. REACT only tested the v0.9 processor, which correctly rejects 1.0 envelopes. CV1 + CV1b (vitest, 2 passing tests): `@path`, `formatString`, `@call`, button `action.event` with resolved `context`, `updateDataModel` live update, custom React component in a v1.0 `Catalog`, `theme` in createSurface rejected with `VALIDATION_FAILED`. REACT's "no `./v1_0` export in @a2ui/react" stays true and is irrelevant: import the processor from web_core, the view from react. |
| C2 | AGENT lists agent->renderer messages as `createSurface, updateComponents, updateDataModel, deleteSurface, callFunction, callRendererFunction, action`. | SPEC is right: exactly 6: `createSurface, updateComponents, updateDataModel, deleteSurface, callRendererFunction, agentFunctionResponse`. `action` is renderer->agent. `callFunction` was v0.9. CV: parsed `agent_to_renderer.json`: top `oneOf` = 6, $defs match SPEC. |
| C3 | AGENT/README sample: `capabilities = {v1_0: {supportedCatalogIds: [...]}}`. SPEC: key is `"1.0"`. | `"1.0"` is right; the README sample THROWS `A2uiValidationError: The renderer capabilities have no '1.0' entry`. CV2. Use `{'1.0': {supportedCatalogIds:[catalog.id]}}`. |
| C4 | zod: `@a2ui/react` peer `zod ^3.25.76`; `ollama-ai-provider-v2` peer `zod ^4.0.16`; reference repo uses zod 4. | Real ERESOLVE conflict (CV5). Resolved with root `zod@3.25.76` plus `"overrides": {"ollama-ai-provider-v2": {"zod": "$zod"}}`. Whole stack installs, `next build` passes, ollama provider works at runtime (CV4). `zod/v4` subpath in 3.25.76 gives `z.email`, `z.discriminatedUnion`, `z.toJSONSchema` (CV4). Rejected alternative: zod 4 at root (would mix zod copies with web_core's `CommonSchemas`, ASSUMED breakage, not tested). |
| C5 | CORE sample: `supportsStructuredOutputs: false`; LOCAL: `true`. | Default `false` makes the SDK send `response_format:{type:"json_object"}` WITHOUT the schema + a warning; `true` sends `{type:"json_schema",json_schema:{schema,strict,name}}`. CV4 (mock server captured both). Use `true` by default for LM Studio/llama.cpp/vLLM; expose it as a per-provider flag for servers that reject json_schema. |
| C6 | CORE: Ollama base URL default "ASSUMED `http://127.0.0.1:11434/api`". | `createOllama({baseURL})` appends `/chat`; with `baseURL = .../api` the request hits `/api/chat`, body has `format:<json schema>`, `options:{num_ctx,...}`, `stream:false` for generateText. CV4. Always pass baseURL explicitly. |
| C7 | TypeScript: CODEGEN "ASSUMED 5.x, 7.0.2 exists"; CANVAS used 7.0.2; REACT used 5.9.3. | Pin `typescript@5.9.3` for the app: PROVEN with Next 16.4.6 `next build` (CV6). 7.0.2 is only proven with bare `tsc` (CANVAS) , not with Next; do not adopt without a build test. |
| C8 | vitest: latest is 5.1.0; reference and REACT probe use 3.2.7. | Pin `vitest@3.2.7` + `jsdom@31.0.1` (PROVEN with a2ui tests). 5.1.0 untested. |
| C9 | UX/CORE copy `react-resizable-panels ^3.0.3` and `lucide-react ^0.517`; registry latest are 4.24.0 and 1.74.0. | Major jumps (API change in panels v4, ASSUMED). Pin `react-resizable-panels@3.0.6` (latest 3.x, VERIFIED `npm view versions`) and `lucide-react@0.577.0` (latest 0.x, VERIFIED) to keep shadcn-new-york snippets working. |
| C10 | REACT says explicit install of `@a2ui/markdown-it` or `@a2ui/web_core` causes ERESOLVE. | Do not list them in package.json; `@a2ui/react` pulls them. Confirmed: `npm ls` shows a nested `@a2ui/web_core@0.14.0` under markdown-it, works at runtime. Importing `@a2ui/web_core/v1_0` from app code needs web_core resolvable: it IS hoisted (via `@a2ui/react`/`@a2ui/agent`), build passes (CV6). If a future npm hoists differently, add `@a2ui/web_core@0.15.0` WITHOUT markdown-it. |
| C11 | CODEGEN pins `@types/node 24.19.2` for generated backend; app uses Node 26. | No conflict: generated backend targets Node 24 (its own package.json). The studio app: `@types/node@24.19.2` also works (CV6). |

## 2. Dependency list for the studio app (pinned, no carets)

PROVEN together = installed + `next build` OK in `integration-probe` (CV5, CV6). Others VERIFIED by `npm view` on 2026-11-17.

```json
{
  "dependencies": {
    "next": "16.4.6",
    "react": "19.3.1",
    "react-dom": "19.3.1",
    "zod": "3.25.76",
    "ai": "7.0.173",
    "@ai-sdk/react": "4.0.177",
    "@ai-sdk/openai-compatible": "3.0.92",
    "ollama-ai-provider-v2": "4.1.0",
    "@a2ui/react": "0.15.0",
    "@a2ui/agent": "0.1.0",
    "@xyflow/react": "13.0.1",
    "@dnd-kit/react": "0.5.3",
    "zustand": "5.1.0",
    "zundo": "2.3.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "@types/react": "19.3.0",
    "@types/react-dom": "19.3.0",
    "@types/node": "24.19.2",
    "tsx": "4.23.15"
  },
  "overrides": {
    "ollama-ai-provider-v2": { "zod": "$zod" },
    "dompurify": "3.4.18"
  }
}
```
Backs: PROVEN list above (CV5/CV6). `dompurify` override: `@a2ui/markdown-it` pulls dompurify 3.4.11 with a CRITICAL advisory (XSS, `npm audit`); 3.4.18 is latest and the override installs and builds (CV7).

Add as needed (VERIFIED versions, not integration-tested):
- Cloud providers (same V4 spec line, VERIFIED CORE/LOCAL): `@ai-sdk/anthropic@4.0.105`, `@ai-sdk/google@4.0.121`, `@ai-sdk/groq@4.0.84`, `@openrouter/ai-sdk-provider@3.1.0`. `@ai-sdk/openai@4.0.118` (use `.chat(id)` for local servers).
- Styling/UI: `tailwindcss@4.3.5`, `@tailwindcss/postcss@4.3.5`, `@tailwindcss/typography@0.5.20`, `tw-animate-css@1.4.0`, `clsx@2.1.1`, `tailwind-merge@3.7.0`, `class-variance-authority@0.7.1`, `motion@14.14.0`, `lucide-react@0.577.0`, `react-resizable-panels@3.0.6`, `@monaco-editor/react@4.7.0` (UX; only if a code tab is built).
- Canvas extras: `@dagrejs/dagre@3.1.3` (auto layout), `immer@11.2.10` (optional).
- Codegen/browser: `fflate@0.8.3` (zip), `yaml@2.9.1`, `sql-formatter@15.9.0` (lazy), `@dbml/core@12.1.0` (lazy, 37 MB unpacked, optional), `idb-keyval@6.3.0` (persistence, ASSUMED fit).
- Tests: `vitest@3.2.7`, `jsdom@31.0.1`, `@testing-library/react@16.3.3`, `@vitejs/plugin-react` (REACT/CORE used ^4.5.2; latest 6.3.0 untested, pin 4.x), `vite-tsconfig-paths` (CORE ^5.1.4; latest 6.1.1 untested), `@playwright/test@1.65.1` (VERIFIED latest, equals reference).
- Windows scripts: `cross-env@10.1.0` (VERIFIED `npm view`; syntax in 8).

Generated-backend template pins (CODEGEN, VERIFIED registry only, NOT compiled): `hono@4.13.19`, `@hono/node-server@2.1.9`, `zod@4.6.7`, `pg@8.23.1`, `ioredis@6.0.0`, `tsx@4.23.15`. Prisma `latest` is a prerelease (8.0.0-rc.34): only emit Prisma TEXT, do not depend on the package.

## 3. A2UI v1.0 message shapes we will use (SPEC, VERIFIED from spec + schema; shapes PROVEN in CV1)

Envelope: every message = `{"version":"1.0", <exactly one key>}`. Agent->renderer keys: `createSurface | updateComponents | updateDataModel | deleteSurface | callRendererFunction | agentFunctionResponse`. Renderer->agent keys: `action | callAgentFunction | rendererFunctionResponse | error`.

```jsonc
// one-shot surface (PROVEN): components + dataModel inside createSurface
{"version":"1.0","createSurface":{
  "surfaceId":"main",
  "catalogId":"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
  "sendDataModel":false,
  "dataModel":{"name":"Ana"},
  "components":[
    {"id":"root","component":"Column","children":["t","b"]},
    {"id":"t","component":"Text","text":{"@call":"formatString","args":{"value":"Hello ${/name}!"}}},
    {"id":"bl","component":"Text","text":"Go"},
    {"id":"b","component":"Button","child":"bl","action":{"event":{"name":"go","context":{"n":{"@path":"/name"}}}}}
  ]}}
// incremental
{"version":"1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Column","children":["t"]}]}}   // upsert by id, FULL replace of that component
{"version":"1.0","updateDataModel":{"surfaceId":"main","path":"/name","value":"Bia"}}   // value REQUIRED; null deletes; omit path = replace root
{"version":"1.0","deleteSurface":{"surfaceId":"main"}}
```
Renderer->agent (what our `onAction` receives, PROVEN shape `{name,surfaceId,sourceComponentId,timestamp,context}`; wire form wraps it as `{"version":"1.0","action":{...}}`):
```json
{"version":"1.0","action":{"name":"go","surfaceId":"main","sourceComponentId":"b","timestamp":"2026-11-17T13:38:48Z","context":{"n":"Ana"}}}
```
Rules (SPEC, VERIFIED): a component with `id:"root"` must exist; ids follow UAX#31 (`user_card` ok, `user-card` NOT); `createSurface` with `theme` is invalid (PROVEN: `VALIDATION_FAILED path /theme`); surfaceId unique per renderer lifetime; templates: `children:{"componentId":"tpl","path":"/items"}` (plain path, relative `@path` inside); error codes `VALIDATION_FAILED, UNALLOWED_PARENT, UNALLOWED_CHILD, INTEGRITY_ERROR, INVALID_FUNCTION_CALL, EXECUTION_ERROR, EXPRESSION_ERROR, UNKNOWN_FUNCTION`.
Basic catalog v1.0 (SPEC, 18 components, 14 functions). Text `variant` is ONLY `caption|body` (PROVEN: `"h2"` rejected by the agent compiler). Heading-style text needs a custom component (e.g. `Heading`) or markdown `#` inside `text` (markdown renderer required, see pitfalls).
Wire transport (AGENT, design): `POST /api/a2ui` returns JSONL, one envelope per line; actions via `POST /api/a2ui/action`; capabilities in request body (spec leaves transport free).

## 4. The proven @a2ui/react usage (v1.0)

File: `a2ui-probe/src/v10render.test.tsx` and `v10custom.test.tsx`; Next variant: `integration-probe/components/SurfaceView.tsx`. All passed.

```tsx
'use client';                       // the package has no "use client"; see pitfall P1
import {z} from 'zod';
import {MessageProcessor, Catalog, CommonSchemas, basicCatalog} from '@a2ui/web_core/v1_0';
import {A2uiSurface, MarkdownContext, createComponentImplementation} from '@a2ui/react/v0_9';
import {renderMarkdown} from '@a2ui/markdown-it';           // optional: markdown in Text

// 1) custom component = zod API + React view (same API object is given to the agent, see 5)
export const HeroApi = {
  name: 'Hero',
  description: 'Landing hero with headline and call to action button.',
  schema: z.object({
    title: CommonSchemas.DynamicString,     // literal | {"@path":..} | {"@call":..}
    cta: CommonSchemas.DynamicString,
    onCta: CommonSchemas.Action,            // becomes () => Promise<void> in props
  }),
};
const Hero = createComponentImplementation(HeroApi as any, ({props}: any) => (
  <section className="hero"><h1>{props.title}</h1><button onClick={() => props.onCta()}>{props.cta}</button></section>
));

// 2) catalog: a surface has ONE default catalog, so include the basic components too
export const vitrineCatalog = new Catalog('https://vitrine.studio/catalogs/v1/catalog.json', '1.0',
  [...(basicCatalog as any).components.values(), Hero as any],
  [...(basicCatalog as any).functions.values()]);

// 3) processor + surface
const processor = new MessageProcessor([vitrineCatalog as any], (action: any) => { /* ActionPayload */ });
processor.processMessages(arrayOrSingleV1Message);            // sync; also processMessagesWithErrors() (never throws, returns renderer error envelopes)
const surface = processor.model.surfacesMap.get('main')!;     // or processor.onSurfaceCreated(cb)
// <MarkdownContext.Provider value={renderMarkdown as any}><A2uiSurface surface={surface as any} /></MarkdownContext.Provider>
surface.dataModel.set('/name', 'x');                          // external write re-renders (PROVEN v0.9, same API)
```
Notes: output DOM is custom elements (`<a2ui-basic-column>`, `<a2ui-react-hero style="display:contents">`); basic styles auto-inject (no CSS import); `A2uiSurface` renders nothing until `root` arrives. Types: v1.0 objects need `as any` at the boundary (react d.ts is typed against v0_9); runtime is fine; `tsc` clean (CV1b). `ComponentApi` may carry `allowedParents`/`allowedChildren` (enforced, REACT 0.15.0 changelog).
Version pin trap: `@a2ui/react` has had breaking changes nearly every minor; keep `0.15.0` exact and isolate A2UI behind `src/lib/a2ui/*` (processor + view adapter).

## 5. The proven agent-side snippet (@a2ui/agent 0.1.0), CV2/CV3

```ts
import {A2uiGenerator, CatalogConfig, ComponentPruningTransformer, FunctionPruningTransformer, validatePayload} from '@a2ui/agent';
const cfg = new CatalogConfig(vitrineCatalog /* the same web_core Catalog as in 4 */, [
  new ComponentPruningTransformer(['Hero','Column','Row','Text','Button','Card','Image','Divider']),
  new FunctionPruningTransformer(['formatString']),
]);
// or CatalogConfig.fromPath('catalog.json') for a JSON catalog file
const gen = new A2uiGenerator([cfg]);                                          // default format = Express
const proc = gen.createProcessor({'1.0': {supportedCatalogIds: [vitrineCatalog.id]}});   // key is '1.0', NOT v1_0
const system = `Role text...\n\n${proc.promptSnippet}`;
for (const part of proc.parseResponse(modelText)) {                            // throws A2uiError; feed message back to the model on retry
  if (part.type === 'a2ui') send(part.a2ui);   // validated v1.0 messages
}
```
Measured: full basic-catalog prompt snippet = 22,170 chars (~5.5k tokens by chars/4, estimate); pruned to 8 components + 1 function incl. custom `Hero` = 10,184 chars (~2.5k tokens). Express `root = Column([Hero("Welcome","Start",Event("cta")), Text("Footer")])` compiled to flat v1.0 components with deterministic ids (`root_children_0`...). Errors are actionable text: `Component 'Hero' is not defined in the catalog`, `Value 'h2' is not a valid enum choice ... Allowed values are: ['caption','body']`, Direct JSON dangling child -> `A2uiIntegrityError ... references non-existent component 'nope'`. Direct JSON works with `new DirectJsonFormatFactory()` as 2nd arg to `createProcessor` and tag `<a2ui-json>[...]</a2ui-json>`.
Streaming (`proc.openStream({afterRejectedBlock:'continue'})`, `feed(chunk)`, `close()`): with 7-char chunks, text parts emitted immediately and the whole `<a2ui>` block emitted as ONE part when the closing tag arrived (no per-component progressive parts observed). Do not promise progressive component streaming without testing larger blocks.
Fallback if the SDK proves too young: skip it, emit v1.0 JSON ourselves and gate with `validatePayload(catalogs, payload)` (exported, AGENT d.ts).
Weak/local model strategy (AGENT, ASSUMED ranking, untested on a model): rank 1 typed decision JSON via `Output.object` compiled by our code into A2UI; rank 2 Express via SDK. Benchmark both on the target local model before choosing.

## 6. Local AI (LOCAL + CV4; CORE for guardrails)

| Backend | Package | baseURL | Notes |
|---|---|---|---|
| Ollama | `ollama-ai-provider-v2@4.1.0` `createOllama({baseURL:'http://localhost:11434/api'})` | `/api` | `providerOptions:{ollama:{options:{num_ctx:8192,temperature:0.2}}}` PROVEN in request body; `Output.object` -> `format:<schema>` PROVEN. Peer zod ^4 overridden (C4). |
| LM Studio | `@ai-sdk/openai-compatible@3.0.92` | `http://localhost:1234/v1` | LOCAL VERIFIED port from docs |
| llama.cpp | same | `http://127.0.0.1:9931/v1` | LOCAL VERIFIED default port; chat json_schema path ASSUMED |
| any OpenAI-compatible | same | user `/v1` | `createOpenAICompatible({name, baseURL, apiKey?, supportsStructuredOutputs:true})`; callable `provider('id')` and `.chatModel('id')` both exist and return `specificationVersion:'v4'` (PROVEN CV4) |

Alternative richer Ollama provider: `ai-sdk-ollama@4.6.3` (peer ai ^7.0.137; retry/repair layers can hide model failures). Not used. Avoid `ollama-ai-provider` v1 (stale).
Server-side only: resolve model in a route handler (no CORS); SSRF guard on user `baseURL` (localhost-only unless env flag); keys never persisted server-side; `supportsStructuredOutputs` must be settable per provider.
Weak-model guardrails to port from CORE (VERIFIED in repo): force first tool call for non-Anthropic providers (`prepareStep` + `toolChoice:{type:'tool'}`), validate inside the tool and return actionable error text, `maxRetries:6`, step cap via `isStepCount(n)` (exists, also `stepCountIs`), `friendlyAIError` incl. a local-server-down message. Local providers must NEVER be auto-selected (explicit `AI_PROVIDER` only).
Mock model (CORE): implement `LanguageModelV4` (`specificationVersion:'v4'`, `doGenerate`, `doStream`) emitting Express/A2UI JSON per canvas kind; mandatory for tests/demo (Ollama is not installed here).
Model tags (LOCAL): only `qwen2.5-coder:{7b,14b,32b}` VERIFIED to exist; "best model in Nov 2026" is ASSUMED, re-check `ollama.com/library`. Ollama default context 4096 silently truncates: always set `num_ctx`.

## 7. Canvas decisions (CANVAS, VERIFIED by probe)

- UI canvas: tree editor over `{id, component, props, children}` + `@dnd-kit/react@0.5.3` (`DragDropProvider`, `useDraggable`, `useDroppable`, `useSortable` from `@dnd-kit/react/sortable`); strict-TS clean; flat sortable only. **Nested row>column>block sortable UNPROVEN**: spike first; fallback `@atlaskit/pragmatic-drag-and-drop@4.0.0` (not probed). Reject `@dnd-kit/core` (JSX namespace break on @types/react 19), `react-dnd`, tldraw (commercial license, VERIFIED), Excalidraw (freehand model).
- Architecture + ER canvases: `@xyflow/react@13.0.1`. v13 API: NO `applyNodeChanges`/`applyEdgeChanges`; use `useNodesState`/`useEdgesState`; `screenToFlowPosition` from `useReactFlow()`; wrap in `ReactFlowProvider`; per-column `<Handle id=...>` works; `toObject()` for JSON; CSS import needs `declare module '@xyflow/react/dist/style.css'`. Render canvases from client-only components (SSR ASSUMED hazard, not tested).
- State: `zustand@5.1.0` + `zundo@2.3.0` (`temporal` + `partialize`); same store pattern for all three canvases.
- Native HTML5 drop for palette->canvas works (React Flow official pattern); jsdom cannot test DnD: unit-test tree-move functions, Playwright for gestures.
- "Reimaginar": send STRUCTURED canvas JSON (not a screenshot) and get back A2UI (CANVAS 3.5 rationale; make-real was image->HTML). Never run model-produced code.

## 8. Codegen / DB (CODEGEN; only registry facts VERIFIED, all code ASSUMED/uncompiled)

LLM emits IR (`ArchitectureGraph`, `ErModel`, `ProjectDraft`, zod `.strict()`); templates emit files/DDL/Prisma/Drizzle/DBML/compose; rule engine G001-G012, E001-E015 (offline review). Zip with `fflate`. The IR zod code in CODEGEN 7 uses zod 4 root API: when pasting, change import to `'zod/v4'` (C4); `z.email()` etc. verified to exist there (CV4). Link entities by stable ids (landing element -> endpoint -> arch node -> entity). Redis Streams queue stub is explicitly a non-production stub.
Windows script rules (CORE 5, ASSUMED syntax): reference scripts use POSIX `VAR=x cmd`; in this repo use `cross-env NODE_OPTIONS=--require=./node-compat.cjs next dev` or drop the shim. `next build` ran fine here WITHOUT node-compat.cjs on Node 26 (CV6, build only; `next dev` not tested). npm 11.20 prints "install-scripts not covered by allowScripts" for esbuild (from tsx): approve with `npm install-scripts approve esbuild` if tsx fails.
Persistence (UX, design): IndexedDB + `*.vitrine.json` export/import (zod-validated, `schemaVersion`), debounced autosave. Do not copy: double tool execution, hardcoded JWT fallback secret, unauthenticated paid routes, `allow-scripts allow-same-origin` iframe.

## 9. Verifications performed by the critic

- CV1 (`a2ui-probe/src/v10render.test.tsx`): v1.0 `MessageProcessor`+`basicCatalog` from `@a2ui/web_core/v1_0` -> `A2uiSurface` from `@a2ui/react/v0_9`; rendered `<p>Hello Ana!</p>`, button click gave action `{"name":"go","surfaceId":"s","sourceComponentId":"b",...,"context":{"n":"Ana"}}`. PASS.
- CV1b (`v10custom.test.tsx`): custom `Hero` in v1.0 `Catalog` rendered, action fired, `updateDataModel` re-rendered to "Updated", `theme` rejected. PASS; `tsc --noEmit` clean.
- CV2/CV3 (`agentprobe2/smoke.mjs, smoke2.mjs, smoke3.mjs`): agent SDK runtime: prompt generation, Express compile to v1.0, error texts, pruning, custom component from a zod-built Catalog, Direct JSON path, streaming. The `v1_0` capability key crashed (C3).
- CV4 (`integration-probe/providers.mts`, local mock HTTP server): request bodies for openai-compatible (flag on/off) and Ollama native incl. `num_ctx`; `Output.object` parsed results; `zod/v4` helpers present.
- CV5: install conflict reproduced (ERESOLVE) and fixed with overrides; `npm ls zod` shows one deduped 3.25.76.
- CV6: Next 16.4.6 `next build` (Turbopack) passes with the full dependency set, an API route importing ai + both providers + `@a2ui/agent` + `zod/v4`, and a client page using `next/dynamic(..., {ssr:false})` for the A2UI view. Control experiment: static import of the A2UI view in the client page FAILS prerender: `ReferenceError: HTMLElement is not defined` (REACT's claim now PROVEN in Next, not only Node).
- CV7: `npm audit --omit=dev`: critical dompurify (via `@a2ui/markdown-it`) fixed by override to 3.4.18; remaining high `zod <4.6.6` advisory (memory exhaustion on oversized constrained collections) hits every zod 3.x; no 3.x fix exists (last 3.x release is a canary). Mitigation: cap model output size (`maxOutputTokens`) and never validate unbounded untrusted arrays with `.max`-less schemas.

## 10. Known pitfalls (cited)

P1 (REACT+CV6) `@a2ui/react` touches `HTMLElement` at import: any server import crashes (Node + Next prerender). Load only via `next/dynamic(..., {ssr:false})` inside a `'use client'` component. No `"use client"` in the package.
P2 (REACT) Do not import `@a2ui/react/styles/structural.css` (export points to a missing file).
P3 (REACT) Markdown in `Text`: needs `<MarkdownContext.Provider value={renderMarkdown}>` (React context); `setMarkdownRenderer` from web_core did NOT work. Without it Text shows a `no-markdown-renderer` span.
P4 (REACT) `A2uiSurface` 0.15.0 renders nothing for missing/unknown components (no placeholders); build our own loading/error UI via `surface.onError` and `processMessagesWithErrors`.
P5 (C3) agent SDK capabilities key is `'1.0'`; README is wrong.
P6 (SPEC) `Text.variant` only `caption|body`; no headings in the basic catalog; ids must be UAX#31 (no hyphens); `createSurface.theme` forbidden; `updateDataModel.value` required.
P7 (REACT/SPEC) A surface has one default catalog; mixing requires `@catalogId`, and there is NO fallback. A custom catalog must include the basic components it uses (spread `basicCatalog.components.values()`).
P8 (C4) zod peer conflict; keep the overrides; do not "fix" with `--force`.
P9 (CV7) dompurify critical advisory in `@a2ui/markdown-it`; keep override. Model-produced markdown/URLs are untrusted: the spec defines NO sanitization or URL policy (AGENT 5.1); `Image.url` and `openUrl` need our own allowlist (`http:`/`https:`/relative only).
P10 (LOCAL) Ollama default context 4096, silent truncation: always `num_ctx`. `supportsStructuredOutputs` default false loses the schema (C5).
P11 (LOCAL/CORE) SSRF via user baseURL; local provider must never be auto-selected; remote hosts behind env allowlist.
P12 (CANVAS) React Flow v13 lacks `applyNodeChanges`; `@dnd-kit/core` breaks strict TS with React 19 types.
P13 (AGENT) `@a2ui/agent` is 0.1.0; macros are Python-only; "Jev" decision models are NOT in any SDK (SPEC could not define the term; roadmap item only). Our decision-JSON compiler is a design, not an A2UI feature.
P14 (REACT) Pre-1.0 churn: pin exact versions; isolate behind an adapter module; GitHub `main` README is ahead of the npm package.
P15 (CORE) Reference `.env` has real-looking names only; there is no `.env.example` to copy: create one with names only.
P16 (SPEC) The spec says nothing on end-of-turn; the transport must signal it (close the JSONL stream).

## 11. Remaining gaps (not verified; ordered by build risk)

1. No browser run: A2UI rendering was proven in jsdom and a Next build, never in a real browser (custom elements, `adoptedStyleSheets`). 15-minute check with `next dev` + Chrome before UI work.
2. Nested sortable in `@dnd-kit/react` (row>column>blocks) unproven; React Flow in Next not rendered in a browser.
3. No real LLM was run: Express reliability on a 7B-14B local model, Ollama/LM Studio live behavior, `/v1/models` endpoints, tool calling per model are unmeasured. Ollama is not installed here.
4. `ollama-ai-provider-v2` + `Output.object` was proven against a mock; real Ollama `format` enforcement is as documented (LOCAL), not exercised. Streaming (`streamText`) path through both providers not run.
5. `@a2ui/agent` progressive streaming granularity (see 5) and `RendererState` canvas-update flow (editing an existing surface across turns) not tested; `callRendererFunction`/`callAgentFunction` RPC path untested.
6. TypeScript 7.0.2 with Next not tested; vitest 5.x, plugin-react 6.x, vite-tsconfig-paths 6.x untested.
7. Not read by anyone: a2ui.org `concepts/data-binding`, `actions-and-functions`, `guides/defining-a-catalog`, Express grammar proposal (specs saved locally in `research/page_*.md`, `spec-v1.0.md`).
8. CODEGEN code (hono template, Prisma/Drizzle/DBML emitters, `z.email()` use at runtime in generated app) never compiled; Prisma/Drizzle/DBML docs unread; DBML round-trip of cardinality unknown.
9. Preview/Export of a real landing page: no official A2UI->HTML/React exporter exists (AGENT 5.3); our own template exporter must be written (design in AGENT 5.3, ASSUMED).
10. Product/legal: tldraw license decision N/A (rejected); Chrome Prompt API / WebLLM in-browser mode only researched at registry level.
