# A2UI: agent side (SDKs, inference formats, transports, security)

Date of research: 2026-11-17. Scope: how an LLM (including small local models) produces valid A2UI, what the TypeScript/Node tooling is, transports, and the client security model.

Legend: **VERIFIED (how)** = read from a primary source in this session. **ASSUMED** = my inference or general knowledge, not checked against an A2UI source.

Important limitation: a Node test script that would have exercised `@a2ui/agent` at runtime (promptSnippet output, parseResponse behaviour) was **denied by the permission classifier**, so runtime behaviour below is based on the docs and `.d.ts` files only. It has NOT been executed. An engineer should run a 20-line smoke test before committing to the API.

---

## 0. Version landscape (VERIFIED, a2ui.org/llms.txt and spec index)

- Current spec: **v1.0** (`https://a2ui.org/specification/v1.0-a2ui/`). Previous: v0.9.1 (`https://a2ui.org/specification/v0.9.1-a2ui/`). Older v0.8 material is outdated; do not copy it.
- Message envelope: `"version": "1.0"` plus one of `createSurface`, `updateComponents`, `updateDataModel`, `deleteSurface`, `callFunction`, `callRendererFunction`, `action`.
- Basic catalog v1.0 id: `https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json` (VERIFIED: `curl` of the URL; JSON header has `"protocolVersion": "1.0"` and `"catalogId"` equal to the URL).
- Official Basic catalog for the web client: `basicCatalog` exported from `@a2ui/web_core/v1_0` (VERIFIED, a2ui.org agent-integration guide).

---

## 1. Official TypeScript/Node tooling

### 1.1 What exists (VERIFIED via `npm view`, `npm pack`, and reading the `.d.ts` files)

| Package | Version | Published | Role |
|---|---|---|---|
| `@a2ui/agent` | **0.1.0** | 2026-11-02, by a2ui-team | **Official TS/Node Agent SDK.** Prompt generation, parsing, streaming, validation. |
| `@a2ui/web_core` | 0.15.0 | 2026-11-02 | Core (renderer-side) library; agent SDK depends on `^0.15.0`. Exports `basicCatalog` (`/v1_0`), `MessageProcessor`, `RendererState`. |
| `@a2ui/lit`, `@a2ui/react` | 0.15.0 | 2026-11-02 | Official renderers (client side). |
| `@a2ui/catalog-mcp` | (not checked) | - | Official MCP catalog (`McpApp`), referenced by the MCP guide. |
| `@copilotkit/a2ui-renderer` | 1.88.0 | 2026-11-13 | Third-party (CopilotKit) renderer. Depends on `@a2ui/web_core` 0.15.0. |
| `@genkit-ai/a2ui` | 0.7.0 | 2026-11-03 | Third-party (Google Genkit plugin) "model middleware". Not inspected. |
| `@a2ui-sdk/types` | 0.4.0 | 2026-02-02 | Third-party types, old. |
| `@maxhealth.tech/prefab` | (not checked) | - | Third-party TS: builds A2UI from a typed tree, validates, serves over MCP (ecosystem page). |

Not on npm (VERIFIED, 404): `@a2ui/core`, `@a2ui/sdk`, `@a2ui/server`, `@ag-ui/a2ui`, `@a2ui/agent-sdk`.

`npm search a2ui` also returns `a2ui` 1.0.7 from 2016 (unrelated Angular library). Ignore it.

Dependencies of `@a2ui/agent@0.1.0` (VERIFIED, package.json): `@a2ui/web_core ^0.15.0`, `antlr4ng 3.0.16` (the Express grammar is ANTLR-generated). Module type: ESM (`"type": "module"`). License Apache-2.0.

### 1.2 Install

```bash
npm install @a2ui/agent@0.1.0 @a2ui/web_core@0.15.0
```

The package's own README is the install reference (VERIFIED, tarball README). Its own docs say "This package targets A2UI protocol **v0.9** and **v1.0**, and supports the **Direct JSON** and **Express** inference formats." The README getting-started example is:

```ts
import {A2uiGenerator, CatalogConfig, type RendererCapabilities} from '@a2ui/agent';

// 1. Load catalogs and build the generator once at startup.
const componentCatalog = CatalogConfig.fromPath('path/to/catalog.json');
const generator = new A2uiGenerator([componentCatalog]);

// 2. Per request, negotiate active catalogs for the client's capabilities.
const capabilities: RendererCapabilities = {
  v1_0: {supportedCatalogIds: [componentCatalog.catalog.id]},
};
const processor = generator.createProcessor(capabilities);

// 3. Append processor.promptSnippet to your LLM system prompt, then parse the reply.
const systemPrompt = `You are a helpful assistant.\n\n${processor.promptSnippet}`;
const llmResponse = await callYourModel(systemPrompt, userMessage);

for (const part of processor.parseResponse(llmResponse)) {
  if (part.type === 'text') {
    console.log('Text:', part.text);
  } else {
    // Validated AgentToRendererMessage[] ready to send to the renderer
    console.log('A2UI messages:', part.a2ui);
  }
}
```

### 1.3 Exported API surface (VERIFIED, `src/index.d.ts` of 0.1.0)

Main entry points:

- `A2uiGenerator` (`processor/generator.d.ts`): constructed with `CatalogConfig[]`, optional examples, optional `InferenceFormatFactory`. `createProcessor(rendererCapabilities, inferenceFormatFactory?, options?: {state?: RendererState}) -> A2uiRequestProcessor`. Throws `A2uiCatalogError` if capabilities lack the entry for the catalogs' protocol version.
- `A2uiRequestProcessor` (`processor/processor.d.ts`):
  - `promptSnippet: string` (getter): "format-specific system prompt snippet ... covers the format's rules, the active catalogs and any examples."
  - `parseResponse(content, {wrapped?, state?}) -> ResponsePart[]`: throws `A2uiError` (has `partialResults`) if a block cannot be read or a message is rejected. Applied to the state all-or-nothing.
  - `openStream({wrapped?, state?, afterRejectedBlock?: 'end'|'continue'}) -> ResponseStream`: `feed(chunk)` and `close()` return parts.
  - `createState() -> RendererState`, `acceptsState(state)`, `catalogs`, `parser`, `state`.
- `CatalogConfig` (`processor/catalog-config.d.ts`): `CatalogConfig.fromPath(path, transformers?, protocolVersion?, catalogId?)`. `.catalog`, `.transformedCatalog`. The SDK bundles no catalogs.
- `ComponentPruningTransformer`, `FunctionPruningTransformer` (`catalog-transformers/pruning.d.ts`): shrink the catalog shown to the model. Useful for small models (fewer components = fewer prompt tokens and fewer wrong choices). Argument shape not inspected.
- `InMemoryCatalogProvider`, `FileSystemCatalogProvider`, `resolveCatalogs`.
- `validatePayload(catalogs, payload)` (`utils/validation.d.ts`): stateless check of one payload (e.g., a tool-call argument). Throws `A2uiValidationError` (or subclass `A2uiIntegrityError`). Also throws `A2uiCatalogError` if catalog protocol versions mismatch.
- `RendererState` (`utils/renderer-state.d.ts`): per-conversation record of what the renderer holds. Needed for "canvas" updates; not needed for "chat" (each turn new UI).
- Inference formats: `ExpressFormatFactory` (default), `DirectJsonFormatFactory`, plus `ExpressDecompiler`, `DirectJsonDecompiler`, `ExpressPromptGenerator`, `DirectJsonPromptGenerator`, `ExpressResponseStream`, `DEFAULT_EXPRESS_PROGRESSIVE_KEYS`.
- Skills: `SkillGenerator` (`skill/generator.d.ts`): `generateSkill()`, `generateCoreSkill()`, `generateCatalogSkill()`, `generateSkillSet()`. Compiles format rules + catalogs into agent "skill" packages.
- Errors: `A2uiError`, `A2uiValidationError`, `A2uiCompilationError`, `ExpressSyntaxError`, `ExpressUnknownComponentError`, `ExpressUnknownPropertyError`, `ExpressMissingRequiredPropertyError`, `ExpressUndefinedRootError`, `ExpressUndefinedChildError`, and others (all in `index.d.ts`).

Streaming example (VERIFIED, README):

```ts
const stream = processor.openStream({state});
for await (const chunk of modelStream) {
  for (const part of stream.feed(chunk)) send(part);
}
for (const part of stream.close()) send(part);
```

Parts: `type: 'text' | 'a2ui' | 'error'`. A2UI parts carry `part.a2ui: AgentToRendererMessage[]`.

Canvas state (VERIFIED, README):

```ts
const state = processor.createState();
processor.parseResponse(firstReply, {state});
processor.parseResponse(secondReply, {state}); // may update components from turn 1
```

### 1.4 Prompt generation from a catalog (VERIFIED for API existence; text content partly ASSUMED)

`processor.promptSnippet` is generated from the catalog schemas (VERIFIED: `.d.ts` doc comment, and docs: "Generates skills, system prompt instructions, and examples from catalog schemas, so prompts don't go stale when components change"). The Express prompt is built from a fixed `EXPRESS_RULES` string (VERIFIED, read from `src/inference-formats/express/prompt-generator.js`) plus per-catalog component signatures. The rules in that string (verbatim excerpts, abbreviated):

- Rule 2: "The interface tree must have a single entry point assigned to the reserved variable 'root'."
- Rule 10: "Assign a value directly to an absolute data path (e.g. `$/path/to/key = "value"`) to populate or initialize values inside the shared dataModel."
- Rule 14: "Parameters named 'action' ... are strictly required... If no specific action is described in the user request, you must provide a dummy click event like `Event("click")`."
- Rule 13: "Arguments annotated with '(static)' ... MUST be defined as literal values ... You CANNOT use a dynamic data binding path."
- Rule 15: "Output `surface(surfaceId)` to specify or target a user interface surface."

The prompt tells the model to wrap output in literal `<a2ui>` ... `</a2ui>` tags and forbids backtick fences around them. Each prompt is therefore: our role text + `promptSnippet` (rules + catalog signatures + examples). Exact token count of the snippet was **not measured** (the test run was denied). Estimate: a Basic-catalog snippet is probably a few thousand tokens; measure it.

### 1.5 Validation (VERIFIED)

Three layers, all in the SDK:
1. Format-level compile errors (`ExpressSyntaxError`, etc.) for bad notation.
2. Message-level validation against the catalog (unknown component, unknown property, missing required property, undefined child, missing `root`).
3. Renderer-state check (`RendererState`): the message would be accepted by a renderer holding the catalogs. Topology (dangling child IDs) checked across the whole response.

`parseResponse` throws; the caller feeds the error text back to the model on a retry turn (VERIFIED, agent-integration guide: "Send the failed output and error back to the model on a retry turn."). That retry loop is the main reliability mechanism the docs offer.

### 1.6 Repair and partial output (VERIFIED)

- Express streaming heals open string literals on `progressiveKeys` (VERIFIED: `DEFAULT_EXPRESS_PROGRESSIVE_KEYS`, `healProgressiveFragment` in `response-stream.d.ts`). Only string properties listed there stream before their closing quote.
- Direct JSON streaming: "strips Markdown code fences and heals incomplete strings as they stream" (VERIFIED, inference-formats page).
- `afterRejectedBlock: 'continue'` returns an `ErrorPart` and keeps reading. Use it for UI that shows partial results.

### 1.7 Python-only features (VERIFIED)

- `@macro` decorator and `MacroExpander` exist only in the Python SDK `a2ui-agent-sdk` (VERIFIED, macros guide: "Macros are currently available only in the Python agent SDK").
- Jev-style decision models: not in any SDK yet (see section 2.3).

### 1.8 Community TS/Node options

- `@maxhealth.tech/prefab` (TypeScript): builds A2UI payloads from a typed component tree, checks catalog compatibility, serves A2UI over MCP (VERIFIED, ecosystem page). Not inspected further.
- `@genkit-ai/a2ui` 0.7.0: Genkit middleware for A2UI streaming (VERIFIED existence and description from npm). Not inspected. Skip unless we use Genkit.
- Go: `satorunooshie/a2ui-go`, `tmc/a2ui` (not relevant to us).

**Conclusion for TS:** an official TS agent SDK exists (`@a2ui/agent`, 0.1.0, young). It covers prompt generation, Express/Direct-JSON parsing, streaming, and validation. What it does NOT have (VERIFIED by absence in its docs and `.d.ts`): a macro system, a Jev decision-model format, a JSON-schema/grammar export for constrained decoding, and any HTML/React export. Those we must write ourselves if we want them.

---

## 2. Express, macros, and Jev-style decision models

### 2.1 A2UI Express (VERIFIED)

Express is a compact notation compiled to A2UI by the SDK. It is the **default** format in `@a2ui/agent`. Wrapped in `<a2ui>...</a2ui>`.

Syntax examples (VERIFIED from docs and the SDK's rules string):

```
<a2ui>
header = Text("Board now", variant="h2")
card = Card(Column([header, Button(Text("Check in"), action=Event("check_in", {flight: $/flight/number}))]))
$/flight/number = "OS 87"
root = card
</a2ui>
```

Notes from the docs and rules (VERIFIED):
- Constructors are called positionally or by keyword: `Text(text, variant?)`. Signatures come from the active catalog.
- Assignments `name = Component(...)`; `root` is required.
- Data model writes: `$/path = value` (populates the surface's data model).
- Data bindings: `$/user/firstName` (absolute), `$firstName` (relative in a list template), `$` alone (current item).
- Events: `Event("save_deal", {rep: $/form/rep})`.
- Dynamic lists: `_template($/path/to/list, itemTemplate)` then `itemTemplate = Image($url)` on another line.
- Delete: `deleteSurface("dashboard-surface-1")`.
- Surface target: `surface("dashboard-surface-1")`; follow-ups use `surface("id", update=true)` (VERIFIED, agent-integration guide).
- Checks use `?`: `?required`, `?regex("^[0-9]{5}$", "Postal code must be 5 digits")`.
- Verbatim from the inference-formats page: `Button(Text("Board now"), action=Event("check_in", {flight: $/flight/number}))`.

Parsing: the parser "heals open strings on configured progressiveKeys, flattens the nested tree, and assigns deterministic IDs such as `root_child`" (VERIFIED, inference-formats page). Compiled output in v1.0 folds initial data into `createSurface.dataModel`.

**Token-cost measurements (VERIFIED, inference-formats page, benchmark "core_v1_0", 54 samples):**
- Model named on the page: "gemini-3.8-flash", temperature 0.0 (as written; the page's model name is unusual, so treat the numbers as vendor data).
- Without thinking: input tokens 10,980 (Direct JSON) -> 6,000 (Express), -45.4%. Code tokens 807 -> 297 (-63.2%, 2.7x).
- With unbounded thinking: code tokens 794 -> 260 (-67.3%, 3.1x). Total output 2,320 -> 1,789 (-22.9%).
- Pass@1 98.1% for both formats.
- The page's general claim: raw wire JSON is "roughly three times longer than positional constructor calls".
- Google's launch blog claims Express "can cut latency by up to 3x" (VERIFIED via WebSearch summary of developers.googleblog.com; not opened).

**Weak-model guidance:** the page says Direct JSON "tends to cause more syntax and reference errors on smaller, faster models" (VERIFIED). It does not publish Express results for small models. So "Express is better for weak models" is what the docs imply, but **not** measured by them. ASSUMED until we test on a local model.

### 2.2 Direct JSON (VERIFIED)

Wrapped in `<a2ui-json>[ ... ]</a2ui-json>`. Model emits wire JSON directly, one array of envelopes:

```
<a2ui-json>[{"version":"1.0","createSurface":{"surfaceId":"s1","catalogId":"https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json"}},{"version":"1.0","updateComponents":{"surfaceId":"s1","components":[{"id":"root","component":"Text","text":"Hi"}]}}]</a2ui-json>
```

(Shape of `createSurface`/`updateComponents` taken from the v1.0 message docs; exact field names should be confirmed against `https://a2ui.org/concepts/messages/` before use. The `version`/`createSurface` shape in the spec is "createSurface ... can carry components and dataModel in one payload".)

Use Direct JSON for: legacy v0.8 payloads, debugging raw wire output, or a model fine-tuned on A2UI JSON (VERIFIED, docs). Not recommended for weak models.

### 2.3 Macros (VERIFIED)

Server-side Python functions decorated with `@macro` that expand to standard catalog components before the renderer sees them. Python only.

```python
@macro
def FlightCard(flight: str, route: str, status: DynamicString) -> Card:
    """Summary card for a flight with a live status line.
    Args:
        flight: Flight number, such as "OS 87".
        route: Departure and arrival cities, such as "Vienna to New York".
        status: Current status text or data binding.
    """
    return Card(
        child=Column(
            children=[
                Text(text=f"### {flight}"),
                Text(text=route, variant="caption"),
                Text(text=status),
            ]
        )
    )
```

The model writes one line in Express:

```
root = FlightCard("OS 87", "Vienna to New York", $/flight/status)
```

`MacroExpander` expands it on the server. Docs' stated purpose: fewer output tokens and latency, and layouts stay consistent. No measured savings published. The schema for the model is generated from type hints and the docstring.

For us: macros are not available in TypeScript. The equivalent is ASSUMED to be our own TS "template" layer: a registry of named builders that the server expands before `parseResponse`, or that we describe in the prompt and that our code expands. That is a design choice for us, not an A2UI feature.

### 2.4 Jev-style decision models (VERIFIED: roadmap, and secondary coverage; NOT in any SDK)

- A2UI roadmap (VERIFIED, a2ui.org/roadmap/): "Official SDK support for decision models such as Jev, for layout decisions up to 80x faster" is listed under "Configure". The page gives no dates ("Plans can change"). Jev is described there as "an inference format" for Agent SDKs.
- Jev (from TypeSafe, a "System One" model): does not generate text or JSON. It answers many typed questions about a predefined layout in one request, roughly 100 to 300 ms (VERIFIED via WebSearch summary; secondary source, not the TypeSafe page itself).
- Example third-party pattern (VERIFIED via WebSearch summary): "Apparite (jev2ui)" — a Markdown grammar of questions written in advance; Jev decides screen structure; code assembles A2UI components; a small model writes only the text (`gemini-3.5-flash-lite`). Not inspected.
- Google's "up to 80x faster at making layout decisions" and "up to 3x latency" are vendor claims.
- Status: **not implemented in `@a2ui/agent` 0.1.0** (VERIFIED: no such format in `index.d.ts`; only Express and Direct JSON exist, plus a "Custom" extension point via `InferenceFormatFactory`).

**Relevance for us:** the pattern (small model makes a few typed decisions, deterministic code assembles A2UI) is exactly what a weak local model can do reliably. We can implement it today ourselves: model returns a small JSON object matching a fixed schema (layout kind, section list, which catalog component per section), and our TS code builds the A2UI messages. The SDK's `InferenceFormatFactory` allows a Custom format, but building one needs its `PromptGenerator`, `Parser`, and `ResponseStream` (VERIFIED interface names in `inference-format.d.ts` and `parser/parser.d.ts`); the simpler path is to skip the SDK's parser and emit wire JSON with `validatePayload` as the gate (VERIFIED: exported, stateless).

---

## 3. Generation strategies, ranked for weak models

Ranking is my judgment (ASSUMED) using the verified facts above. Rank 1 is the most robust.

1. **Small typed decision JSON, compiled by our code to A2UI (decision-model style).** Model output is a short JSON object constrained to a schema of 5 to 20 fields. Our TS builds A2UI wire JSON from it, then runs `validatePayload` (and the SDK's `RendererState` check if canvas). Cheapest in output tokens; the model can never produce a bad component name because we map from enum choices. Downside: layouts limited to what our compiler knows. Best fit for "Reimaginar" with a weak local model.
2. **A2UI Express via `@a2ui/agent` (SDK default).** Fewest tokens among A2UI-producing options (VERIFIED: -63% code tokens vs Direct JSON, cloud model). Errors are fed back through `parseResponse` retries. Risk: custom notation; weak models may mis-nest `Column([...])` and need retries. Use `ComponentPruningTransformer` to cut the catalog shown to the model.
3. **Structured output (JSON Schema) of the full A2UI envelope list.** Constrains syntax, so no malformed JSON, but the schema is large and the model still must get IDs and references right (dangling child IDs are not caught by JSON Schema). Token cost close to Direct JSON. Medium robustness; needs `validatePayload` afterwards.
4. **Direct JSON (`<a2ui-json>` wire format).** Most error-prone for small models (VERIFIED, docs). Use only for debugging or fine-tuned models.
5. **Tool call per component** (`addButton(...)`, `addText(...)`). Each call is small, but a long page means many round-trips or many tool calls per turn; repeated tool-schema overhead; ordering and parent IDs are the model's job. Not recommended by the A2UI docs (no mention); ASSUMED weakest for small models.

Grammar-constrained decoding (llama.cpp GBNF, vLLM/Outlines, Ollama `format` with JSON schema, LM Studio structured output): **not covered by A2UI docs** (VERIFIED: roadmap has no item). Our local-model stack (Ollama, LM Studio, any OpenAI-compatible server) support for these features is **ASSUMED** from general knowledge; verify per server version before relying on it. Constrained decoding guarantees syntax, not that the component tree is valid, so it pairs with `validatePayload`.

Recommended approach to test first, cheapest to build: **(1) for a weak local model** (decision JSON + our compiler), **(2) as the cloud path** (Express via SDK). Measure both on the same 10 prompts before choosing.

---

## 4. Transports

A2UI spec (VERIFIED, v1.0 spec page): the core spec is **transport-agnostic**. The transport must:
- deliver messages **in order** ("Messages must be delivered in the order they were generated.");
- **delimit** individual JSON envelopes (examples given: JSONL newline, WebSocket frame, SSE event);
- carry **metadata** per message;
- provide a **return channel** for `action` messages (bidirectional path is optional for rendering, needed for actions).

Transports named in the docs (VERIFIED): A2A (extension `https://a2ui.org/a2a-extension/a2ui/v1.0`), AG-UI, MCP (`application/a2ui+json` embedded resources), plain HTTP with SSE or JSONL (the client-integration guide's example uses `POST /api/agent` with SSE `data:` lines), WebSockets, gRPC.

Community renderer `svelte-a2ui` advertises "HTTP JSONL/SSE and A2A transports" (VERIFIED, ecosystem page). That confirms JSONL/SSE over HTTP is practiced, not that the spec mandates it.

**Simplest spec-compliant design for one Next.js app with one HTTP route (recommended):**

- Route: `POST /api/a2ui` (request: user prompt + the client's `RendererCapabilities` + optional surface/state id).
- Response: `Content-Type: application/jsonl` (or `text/event-stream` if you prefer SSE). Body = one A2UI envelope JSON per line (JSONL), in generation order. This satisfies "delimited, ordered, one envelope per message".
- Server: `processor.openStream({state})`, `feed(chunk)` per model token chunk, and `send(part)` for each `a2ui` part as produced. Use `afterRejectedBlock: 'continue'` to keep going past one bad block.
- Client: `fetch` + `response.body.getReader()` + `TextDecoder` + split on `\n`, feed each parsed message to `MessageProcessor` from `@a2ui/web_core/v1_0` (or `@a2ui/react`/`@a2ui/lit`).
- Actions (button clicks): separate route `POST /api/a2ui/action` carrying the `action` envelope. Keeps the return channel out of the stream. Consistent with spec ("bidirectional path needed for action messages"), and avoids keeping a socket open.
- Metadata (`a2uiRendererCapabilities`, `a2uiRendererDataModel`): send as a field of the request body on the first call, and on action posts as a field alongside the action (spec puts these in `message.metadata` for A2A; for plain HTTP the field name is ours to choose).

SSE vs JSONL: both are spec-valid per the framing rule. JSONL is simpler to parse in Next route handlers with `ReadableStream`; SSE gives reconnection for free but adds `data:` framing. Choose JSONL unless you need resumable streams.

Not needed for a single app: A2A extension headers, AgentCard, gRPC, MCP.

---

## 5. Security model and the "export to real landing page" requirement

### 5.1 What the spec requires of the client (VERIFIED, v1.0 spec page and client-integration guide)

- **No code on the wire.** "Functions are catalog-defined abstractions that avoid sending raw executable code across the wire."
- **Catalog scoping, no fallback.** "There is 'no fallback to the list of catalogs declared in rendererCapabilities'. Every component and function call must resolve through an explicit `@catalogId`/`catalogId` or the surface default."
- **No remote catalog fetch.** Any external `$ref` into another catalog "makes the catalog invalid"; implementations "MUST NOT fetch the target over the network."
- **Functions:** renderer must "immediately reject the call" if it violates `allowedCallers` or fails validation. `requiresUserActivation: true` functions "MUST only execute when triggered by an active user gesture", and are blocked in passive bindings and `CheckRule.condition` (reported as `EXPRESSION_ERROR`).
- **Data binding:** JSON Pointer (RFC 6901); absolute `/`, relative within collections.
- **Surface rules:** `surfaceId` globally unique for the renderer's lifetime; surface must exist before updates; some component must have `"id": "root"`; `createSurface` carrying `theme` is invalid in v1.0.
- **Partial trees:** renderers "should handle missing references gracefully by rendering placeholders".
- **Inline catalogs:** `includeInlineCatalogs` must stay `false` in production; `true` only during prototyping (VERIFIED, client-integration guide).
- **Unknown components, sanitization, markdown/HTML/URL policy:** **the spec and guides do not define these** (VERIFIED: explicitly absent in the client-integration guide). Markdown is rendered through a configured renderer (`setMarkdownRenderer`) with no sanitization described. Links open through a client callback with no URL rules. We must define these ourselves.

### 5.2 MCP-App sandbox rules (VERIFIED, MCP guides)

Relevant if we ever embed A2UI in an MCP App: opaque origin iframe, `sandbox="allow-scripts"` only, CSP `connect-src 'none'`, self-contained bundle, `allowedTools` allowlist, no `localStorage`/cookies. Not needed for a plain Next.js app.

### 5.3 Implications for exporting a real landing page (HTML or React code)

- **No official exporter exists.** VERIFIED: the ecosystem page lists 22 renderers, 3 agent libraries, and related tools, and states that "No project is described as exporting A2UI to HTML or React source code." The roadmap's CLI "Build" stage covers "Scaffold, generate, preview, and publish components and catalogs" (VERIFIED), not page export. `a2ui codegen` generates "typesafe component builders from a catalog" (VERIFIED), which is about builder code, not pages.
- **The spec's "no code execution" rule is about the renderer, not our exporter.** A2UI forbids the client from executing model-supplied code. An export step is a different thing: our own compiler that reads a validated A2UI surface and emits source. That is allowed, provided the export never takes code (JSX, HTML, JS, CSS, URLs) from the model as raw text.
- **Recommended export design (ASSUMED, our design):**
  1. Export input is a validated A2UI surface (after `validatePayload` / `RendererState` check), never raw model text.
  2. Map each catalog component (`Text`, `Button`, `Column`, `Row`, `Card`, `Image`, etc.) to a fixed template we own. Unknown components fail the export.
  3. Escape all text and attribute values (HTML escaping; React JSX text is escaped by default, but never use `dangerouslySetInnerHTML`).
  4. Allow only `http:`/`https:` URLs (plus relative paths) in `Image.src`, `Link.href`; reject `javascript:`, `data:` (unless we decide otherwise). The spec gives no URL rule, so this is ours.
  5. Markdown fields (if the catalog has them): render via our own sanitized renderer or drop the feature in exported output.
  6. Event bindings (`Event(...)`) in an exported page: either drop them, or wire them to a fixed set of our own handlers. Never emit a call to a function name taken from the model unless it is in our allowlist.
  7. Output is a file tree the user downloads or previews; the export never runs model-generated code on our server.
- This keeps the security property ("the model cannot inject code") intact through the whole path, which is the point of the A2UI model.

---

## Sources (all fetched or checked in this session)

- https://a2ui.org/llms.txt (index of all guides and specs) - VERIFIED
- https://a2ui.org/concepts/sdks/ - VERIFIED (agent SDK table, Go community libs)
- https://a2ui.org/guides/macros/ - VERIFIED
- https://a2ui.org/concepts/inference-formats/ - VERIFIED (Express, Direct JSON, benchmark numbers)
- https://a2ui.org/guides/agent-integration/ - VERIFIED (generator, promptSnippet, streaming, SSE example)
- https://a2ui.org/guides/a2ui-in-mcp-apps/ and https://a2ui.org/guides/mcp-apps-in-a2ui/ and https://a2ui.org/guides/a2ui-over-mcp/ - VERIFIED
- https://a2ui.org/specification/v1.0-a2ui/ (first ~100k chars; tail not read) - VERIFIED for quoted rules
- https://a2ui.org/specification/v1.0-a2ui-extension-specification/ (A2A extension) - VERIFIED
- https://a2ui.org/guides/client-integration/ - VERIFIED (gaps noted)
- https://a2ui.org/ecosystem/renderers/ - VERIFIED
- https://a2ui.org/roadmap/ - VERIFIED
- npm registry: `npm view` for @a2ui/agent, @a2ui/web_core, @a2ui/lit, @a2ui/react, @copilotkit/a2ui-renderer, @genkit-ai/a2ui, @a2ui-sdk/types; 404 for @a2ui/core, @a2ui/sdk, @a2ui/server, @ag-ui/a2ui - VERIFIED
- npm tarball `@a2ui/agent@0.1.0` (extracted to scratchpad `research/pkg-agent/package`): package.json, README.md, `src/index.d.ts`, `src/processor/*.d.ts`, `src/parser/parser.d.ts`, `src/utils/validation.d.ts`, `src/inference-formats/express/prompt-generator.js` (EXPRESS_RULES) - VERIFIED
- https://developers.googleblog.com/fast-reliable-a2ui/ and A2UI 1.0 announcement - seen only via search summary (not opened). Latency claims are vendor-stated.
- Basic catalog v1.0 JSON via curl - VERIFIED

Not done (blocked or skipped): runtime execution of `@a2ui/agent` (permission denied for the test script); the Express compiler and prompt output were not run; `@genkit-ai/a2ui`, `@maxhealth.tech/prefab`, and `@a2ui/catalog-mcp` were not inspected; the v1.0 spec tail (after 100k chars) was not read; the GitHub `agent_sdks/` folder was not read directly (the SDK docs page and the installed tarball were used instead).

---

## Open questions for the team

1. Run a smoke test of `@a2ui/agent@0.1.0`: `createProcessor` -> measure `promptSnippet` token count with the Basic v1.0 catalog -> `parseResponse` on a sample Express block -> confirm the error text for a bad component name. (Blocked in this session; must be done by an engineer.)
2. Benchmark on the target local model (e.g., a 7B-14B instruct model through Ollama or LM Studio): Express vs decision-JSON-then-compile, on 10 prompts, counting first-try validity and retries.
3. Confirm the exact `createSurface` / `updateComponents` field names in https://a2ui.org/concepts/messages/ before writing our own compiler.
4. Decide whether `@a2ui/agent` (0.1.0, pre-1.0 package, one month old at time of writing) is stable enough for us, or whether we use only `validatePayload` plus our own prompt.
5. Verify grammar-constrained decoding support on the chosen local server (Ollama `format`, LM Studio structured output, llama.cpp GBNF) for the current version.
