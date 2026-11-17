# A2UI React renderer and JS packages: hands-on research

Date of research: 2026-11-17. Probe project: `<scratchpad>/a2ui-probe`
Probe source: `.../scratchpad/a2ui-probe/src/probe.test.tsx` (and `src/v10.test.tsx`), config `vitest.config.mts`, `tsconfig.json`.

Legend: **VERIFIED (how)** = checked against the npm registry, installed files, or a test run. **ASSUMED** = not run.

---

## 1. Packages and versions

| Package | Latest | Modified (npm) | License | Module format | Peer deps |
|---|---|---|---|---|---|
| `@a2ui/react` | 0.15.0 | 2026-11-02 (0.15.0 published 2026-11-02T02:43:37Z) | Apache-2.0 | ESM (`"type": "module"`), plus CJS (`index.cjs`) | `react ^18.0.0 \|\| ^19.0.0`, `react-dom ^18.0.0 \|\| ^19.0.0`, `zod ^3.25.76` |
| `@a2ui/web_core` | 0.15.0 | 2026-11-02 | Apache-2.0 | ESM only (`"type": "module"`, `sideEffects: false`) | none |
| `@a2ui/markdown-it` | 0.2.2 | 2026-10-17 | Apache-2.0 | ESM only | peer `@a2ui/web_core ^0.14.0` |
| `@a2ui/lit` | 0.15.0 | 2026-11-02 | Apache-2.0 | ESM | (Lit renderer, not relevant to React) |
| `@a2ui/angular` | 0.14.0 | 2026-11-02 | Apache-2.0 | - | - |
| `@a2ui/agent` | 0.1.0 | 2026-11-02 | Apache-2.0 | - | server-side agent SDK (TypeScript/Node) |

VERIFIED (`npm view @a2ui/react`, `npm view @a2ui/web_core`, `npm view @a2ui/markdown-it`, `npm search @a2ui`). `npm view @a2ui/react dist-tags` gives only `latest: 0.15.0`. Published versions run 0.9.0, 0.9.1, 0.10.0 ... 0.14.0, 0.15.0. The 0.13.0 publish is dated 2026-10-09, the 0.14.0 publish is dated 2026-10-17, and the 0.15.0 publish is dated 2026-11-02.

Dependencies of `@a2ui/react@0.15.0` (VERIFIED, `npm view` and install tree):
- `@a2ui/web_core ^0.15.0`
- `@a2ui/markdown-it ^0.2.2`
- `markdown-it ^14.2.0` (installed 14.3.3)
- `clsx ^2.1.1`
- `zod ^3.25.76`

Dependencies of `@a2ui/web_core@0.15.0`: `lit ^3.3.3`, `zod ^3.25.76`, `@lit/context ^1.1.6`, `redos-detector ^6.1.4`, `validate-color ^2.2.4`, `zod-to-json-schema ^3.25.2`, `@preact/signals-core ^1.14.2`.

Other packages found by `npm search @a2ui` (none are the official React renderer): `@copilotkit/a2ui-renderer` 1.88.0 (MIT), `@a2ui-sdk/react` 0.4.0, `@a2ui-sdk/types`, `@a2ui-sdk/utils`, `a2ui-shadcn` 0.8.0, `a2ui-vue` 0.9.5, `@xpert-ai/a2ui-react` 0.17.0, `@saga-a2ui/core|react|lit` 1.0.0, `@ag-ui/a2ui-middleware`, `@ag-ui/a2ui-toolkit`, `@threadplane/a2ui` 0.3.7, `@the-a2ui/renderer` 0.3.0 (React Native). Third-party; not evaluated further.

### Version pinning trap (VERIFIED, ERESOLVE)
Installing `@a2ui/markdown-it@0.2.2` directly next to `@a2ui/react@0.15.0` fails:

```
npm error ERESOLVE unable to resolve dependency tree
npm error peer @a2ui/web_core@"^0.14.0" from @a2ui/markdown-it@0.2.2
```

Cause: markdown-it 0.2.2 declares a peer on `@a2ui/web_core ^0.14.0`, while react 0.15.0 requires web_core `^0.15.0`. Workaround used in the probe: do **not** install `@a2ui/web_core` or `@a2ui/markdown-it` explicitly; let `@a2ui/react` pull them in transitively. npm then nests `@a2ui/markdown-it@0.2.2` under `@a2ui/react` and `npm ls` reports the peer as "invalid" only for the nested copy, but the code runs (tests pass). Pin `@a2ui/react@0.15.0` and let it resolve siblings.

Probe install that worked (VERIFIED):
```
npm install @a2ui/react@0.15.0 react@19.3.1 react-dom@19.3.1 zod@3.25.76
npm install -D typescript@5.9.3 @types/react@19.3.0 @types/react-dom@19.3.0 vitest@3.2.7 jsdom@31.0.1 tsx@4.23.15
```
Note: `typescript@7.0.2` is the npm latest; the probe used 5.9.3 because it was installed first and is not a blocker. `react@19.3.1` is dated 2026-10-14, older than two weeks.

---

## 2. Installed package layout (VERIFIED, `node_modules/@a2ui/react`)

`package.json` exports:
- `"."` import: `./index.js` (types `./index.d.ts`), require: `./index.cjs`
- `"./v0_8"`: `./v0_8/index.js` / `.cjs`
- `"./v0_9"`: `./v0_9/index.js` / `.cjs`
- `"./styles"`: `./styles/index.js` / `.cjs`
- `"./styles/structural.css"`: `"./structural.css"`

**Defect:** the `./styles/structural.css` export points to `./structural.css`, which is NOT in the package (`ls` returns "No such file"). Do not import it. The styles are exposed as JS strings from `@a2ui/react/styles` (`injectStyles`, `removeStyles`, `structuralStyles`, `componentSpecificStyles`).

There is **no `./v1_0` export**. `import ... from '@a2ui/react/v1_0'` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`. (VERIFIED, node import.)

Root entry (`@a2ui/react`) exports (VERIFIED, `index.d.ts` line 140): `A2uiSurface`, `MarkdownComponentContext`, `MarkdownComponentProps`, `MarkdownContext`, `NodeBuildChild`, `NodeViewProps`, `ReactA2uiComponentProps`, `ReactCatalogComponent`, `ReactComponentImplementation`, `createBinderlessComponentImplementation`, `createComponentImplementation`, `useA2uiSurface`, `useMarkdownRenderer`, `useNodeView`, `useSignalValue`. The root no longer re-exports v0.8 (CHANGELOG 0.13.0). The **v0.9 API is what you use**: import from `@a2ui/react/v0_9` (same symbols re-exported there).

---

## 3. Real public API (v0.9, VERIFIED from `.d.ts` in `@a2ui/web_core@0.15.0` and `@a2ui/react@0.15.0`)

### 3.1 Create processor, feed messages
```ts
import {MessageProcessor, Catalog, CommonSchemas} from '@a2ui/web_core/v0_9';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';

const processor = new MessageProcessor(
  [basicCatalog],          // Catalog<any>[] (priority order)
  onAction,                // ActionListener = (a: ActionPayload) => void | Promise<void>   (optional)
  {                        // MessageProcessorOptions (all optional)
    version?: ProtocolVersion,
    validationConfig?: ValidationConfig,
    outboundListener?: OutboundMessageListener,
    errorHandler?: (e: RendererErrorMessage) => void,
    reportErrorsOnly?: boolean,
    defaultTimeoutMs?: number,       // default 30000
  },
);
processor.processMessages(messagesArrayOrSingle);             // sync
// or processor.processMessagesAsync(...) -> Promise<RendererFunctionResponseMessage[]>
// or processor.processMessagesWithErrors(...) -> RendererErrorMessage[]  (never throws)
```
`processMessages(payload: ProcessableMessagePayload, context?: ExecutionContext)` accepts a single message, an array, or `{messages: [...]}`.

### 3.2 Message shapes (v0.9, VERIFIED by running them)
Each message is an object with `version: 'v0.9'` and exactly one envelope key:
```ts
{version: 'v0.9', createSurface: {surfaceId: 's1', catalogId: basicCatalog.id, theme?: any, sendDataModel?: boolean}}
{version: 'v0.9', updateComponents: {surfaceId: 's1', components: [
  {id: 'root', component: 'Column', children: ['title', 'btn']},
  {id: 'title', component: 'Text', text: {path: '/title'}, variant: 'h2'},
  {id: 'btn', component: 'Button', child: 'btnText', action: {event: {name: 'save_clicked', context: {who: {path: '/title'}}}}},
  {id: 'btnText', component: 'Text', text: 'Save'},
]}}
{version: 'v0.9', updateDataModel: {surfaceId: 's1', path: '/', value: {title: 'Hello from A2UI'}}}
```
Other envelope key: `deleteSurface`. The `createSurface` schema is `strict` (only `surfaceId`, `catalogId`, `theme`, `sendDataModel`).

Note on the v0.9 processor: a `version: '1.0'` envelope against a v0.9 catalog is rejected (VERIFIED, `src/v10.test.tsx` output):
`Surface 'x' catalog 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json' specification version (0.9) does not match message protocol version (1.0).`

### 3.3 Surface model, reading and writing the data model from outside (VERIFIED by running)
```ts
processor.model.surfacesMap            // ReadonlyMap<string, SurfaceModel>
processor.getSurface('s1')             // SurfaceModel | undefined
processor.onSurfaceCreated(s => ...)   // Subscription (has .unsubscribe())
processor.onSurfaceDeleted(id => ...)

const surface = processor.model.surfacesMap.get('s1')!;
surface.dataModel.get('/title')                 // read  -> 'Hello from A2UI'
surface.dataModel.set('/title', 'Updated title') // write (re-renders bound components; VERIFIED)
surface.dataModel.subscribe('/title', v => ...) // DataSubscription<T>
surface.dataModel.delete('/path')
surface.dispatchAction(payload, sourceComponentId, metadata?)  // emits ActionPayload
surface.onAction  / surface.onError  // EventSource
```
`DataModel` methods (from `state/data-model.d.ts`): `getSignal`, `set(path, value, preserveNull?)`, `delete(path)`, `get<T>(path)`, `hasPath(path)`, `subscribe<T>(path, cb)`, `dispose()`.

### 3.4 Actions coming back out (VERIFIED by running)
`ActionPayload` (from `state/surface-model.d.ts`): `name`, `surfaceId`, `sourceComponentId`, `timestamp` (ISO), `context: Record<string, unknown>`, optional `catalogId`, `userMessage`, `metadata`.

The processor-level `onAction` listener (2nd constructor argument) receives it. Probe result: Button `action: {event: {name: 'save_clicked', ...}}` produced `onAction` with `name === 'save_clicked'` when the DOM button was clicked. Custom component `onGreet: {event: {name: 'greet', context: {}}}` produced `name === 'greet'`.

### 3.5 Rendering a surface (React)
```tsx
import {A2uiSurface} from '@a2ui/react/v0_9';
<A2uiSurface surface={surface} />     // surface: SurfaceModel<ReactCatalogComponent>
```
`A2uiSurface` is `FC<{surface: SurfaceModel<ReactCatalogComponent>}>` (VERIFIED, `index.d.ts`). It is not a Provider; you pass the surface object from `processor.model.surfacesMap`. To re-render on new surfaces, subscribe to `processor.onSurfaceCreated` / `onSurfaceDeleted` and re-read `surfacesMap` into React state (this is the pattern in the README Quick Start).

Hooks: `useA2uiSurface()` returns the enclosing `SurfaceModel` inside an `A2uiSurface` tree. `useSignalValue(signal)`, `useNodeView(node, buildChild)` (for binderless custom views).

### 3.6 Custom catalog: exact signatures and minimal working sample (VERIFIED, test passes)
Signatures (from `@a2ui/react/v0_9` d.ts):
```ts
declare function createComponentImplementation<Api extends ComponentApi>(
  api: Api,
  RenderComponent: React.FC<ReactA2uiComponentProps<ResolveA2uiProps<InferredComponentApiSchemaType<Api>>>>
): ReactComponentImplementation;
declare function createBinderlessComponentImplementation(
  api: ComponentApi,
  RenderComponent: React.FC<ReactRenderProps>   // {context, buildChild, metadata?}
): ReactComponentImplementation;
// ComponentApi (web_core): {name: string; schema: ZodTypeAny; allowedParents?: string[]; allowedChildren?: string[]; metadata?}
// Catalog ctor (v0.9, web_core): new Catalog(id: string, protocolVersion: '0.9' | string, components?: T[], functions?: F[], themeSchemaOrOptions?, instructions?)
```

Working sample (exact code from `src/probe.test.tsx`):
```tsx
import {z} from 'zod';
import {Catalog, CommonSchemas} from '@a2ui/web_core/v0_9';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';
import {createComponentImplementation} from '@a2ui/react/v0_9';

const GreetingApi = {
  name: 'Greeting',
  schema: z.object({
    name: CommonSchemas.DynamicString,   // literal string OR {path: '/user/name'}
    onGreet: CommonSchemas.Action,       // resolves to () => Promise<void>
  }),
};
const Greeting = createComponentImplementation(GreetingApi, ({props}) => (
  <button className="greeting" onClick={() => props.onGreet()}>
    Hi {props.name}
  </button>
));

// A surface has ONE default catalog, so the custom catalog must also carry the basic components used.
const vitrineCatalog = new Catalog(
  'https://example.com/catalogs/vitrine-probe.json',
  '0.9',
  [...basicCatalog.components.values(), Greeting],
  [...basicCatalog.functions.values()],
);

const processor = new MessageProcessor([vitrineCatalog], onAction);
processor.processMessages([
  {version: 'v0.9', createSurface: {surfaceId: 's2', catalogId: vitrineCatalog.id}},
  {version: 'v0.9', updateComponents: {surfaceId: 's2', components: [
    {id: 'root', component: 'Column', children: ['g1']},
    {id: 'g1', component: 'Greeting', name: {path: '/user/name'}, onGreet: {event: {name: 'greet', context: {}}}},
  ]}},
  {version: 'v0.9', updateDataModel: {surfaceId: 's2', path: '/user/name', value: 'Ada'}},
]);
// then <A2uiSurface surface={processor.model.surfacesMap.get('s2')!} />
```

Important: a custom catalog that omits the basic components cannot use `Column`/`Text` on the same surface. Spread `basicCatalog.components.values()` as shown.

`createComponentImplementation` returns a `ReactComponentImplementation` that is also a catalog entry; there is no separate registration call. Putting it in the `Catalog` constructor's component array is the registration.

Binderless alternative (README): `createBinderlessComponentImplementation(api, ({context, buildChild, metadata}) => ...)`. Use only when you need raw `context.componentModel` access.

### 3.7 Theming (VERIFIED from README and web_core source)
- Basic catalog components are styled with CSS custom properties exposed by `@a2ui/web_core`, for example `--a2ui-spacing-m`, `--a2ui-color-on-background`. Example from README: `display:flex; gap: var(--a2ui-spacing-m, 8px);`.
- `createSurface.theme` accepts a theme object (the `theme?: any` field); the basic catalog exports `ThemeSchema` (`BasicCatalogThemeSchema`) from `@a2ui/web_core/v0_9/basic_catalog`.
- Basic catalog styles are injected automatically (VERIFIED in source: `basic-catalog-a2ui-lit-element.js` line 43 calls `injectBasicCatalogStyles()`, which sets `document.adoptedStyleSheets`). In the probe no CSS import was needed.
- Custom components: plain CSS, CSS Modules (README says Vite, Next.js and CRA support them), or inline styles.

### 3.8 Spec versions supported by the installed renderer (VERIFIED)
- **v0.9**: supported, primary path (`@a2ui/react/v0_9`).
- **v0.8**: supported, legacy (`@a2ui/react/v0_8`, `A2UIProvider` + `A2UIRenderer`). Not tested here.
- **v1.0**: NOT supported by the React renderer package 0.15.0. Evidence: no `./v1_0` export; no `1.0` or `v1_0` string in the react chunk (grep count 0); processor rejects v1.0 envelopes against v0.9 catalogs (test run output above). `@a2ui/web_core@0.15.0` DOES ship `./v1_0` (`Catalog`, schemas, 247 exports importable in Node), so a v1.0 renderer on the web_core side exists, but no React adapter for it is published yet.
- The React CHANGELOG 0.14.0 contains a line `(v1_0) A2uiSurface renders a surface whose createSurface names no default catalog`, so some v1.0 handling is in the React code, but it is only reachable through the web_core v1.0 processor, not through a public `@a2ui/react/v1_0` entry. Treat v1.0 React rendering as unsupported in 0.15.0.

---

## 4. Proof: test run (VERIFIED)

Command: `npx vitest run` in the probe (vitest 3.2.7, jsdom 31.0.1, test file has `// @vitest-environment jsdom`). `npx tsc -p tsconfig.json` (strict, jsx react-jsx) exits 0.

Test setup code (abridged, the full file is in the probe):
```tsx
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {renderMarkdown} from '@a2ui/markdown-it';
import {A2uiSurface, MarkdownContext} from '@a2ui/react/v0_9';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function renderSurface(processor, surfaceId) {
  const container = document.createElement('div'); document.body.appendChild(container);
  const surface = processor.model.surfacesMap.get(surfaceId)!;
  const root = createRoot(container);
  await act(async () => {
    root.render(<MarkdownContext.Provider value={renderMarkdown as any}>
      <A2uiSurface surface={surface} /></MarkdownContext.Provider>);
  });
  await new Promise(r => setTimeout(r, 50));
  return {container, root};
}
```

Output (a) standard catalog (trimmed; from the final passing run):
```
[a] HTML:
<a2ui-basic-column>...<a2ui-basic-text><span class="a2ui-text a2ui-text-h2"><h2>Hello from A2UI</h2></span></a2ui-basic-text>
  ...<a2ui-basic-button><button type="button" class=" a2ui-button a2ui-button-default ">
     <a2ui-basic-text><span class="a2ui-text a2ui-text-body"><p>Save</p></span></a2ui-basic-text></button></a2ui-basic-button>...
[a] button element: BUTTON
[a] onAction calls: ["save_clicked"]
[a] after set, text:  Updated title  Save
```

Output (b) custom component:
```
[b] HTML:
<a2ui-basic-column>...<a2ui-react-greeting style="display: contents;"><button class="greeting">Hi Ada</button></a2ui-react-greeting>...</a2ui-basic-column>
[b] onAction names: ["greet"]
```
Final result: `Test Files 1 passed (1)`, `Tests 2 passed (2)`.

Observations:
- Standard components are W3C custom elements (`<a2ui-basic-text>`, `<a2ui-basic-column>`, `<a2ui-basic-button>`), as the README states.
- Custom React component is wrapped in `<a2ui-react-greeting style="display: contents">`.
- Markdown in `Text`: without a renderer, Text shows `<span class="no-markdown-renderer">`. With `MarkdownContext.Provider value={renderMarkdown}` (from `@a2ui/markdown-it`) it renders `<p>Save</p>`. Using `setMarkdownRenderer` from `@a2ui/web_core/v0_9/basic_catalog` did NOT work in the probe (warning persisted). Use the React `MarkdownContext` provider.
- Without `IS_REACT_ACT_ENVIRONMENT = true` vitest prints "The current testing environment is not configured to support act(...)". Setting that global removes it.

### SSR test: renderToString / plain Node import (VERIFIED, failure)
This is a blocker. Any import of `@a2ui/react` (root, `/v0_9`, CJS `require`) in plain Node crashes at module load:
```
file:///.../node_modules/@a2ui/react/chunk-H4D2JAR7.js:98
var ReactWcHost = class extends HTMLElement {
ReferenceError: HTMLElement is not defined
```
The CJS build fails the same way (`chunk-WRJMELUI.cjs:104`). The chunk also declares another class extending `HTMLElement` at line 308.

Entries that DO import cleanly in Node (VERIFIED): `@a2ui/web_core/v0_9`, `@a2ui/web_core/v0_9/basic_catalog`, `@a2ui/web_core/v0_9/universal`, `@a2ui/web_core/v1_0`, `@a2ui/react/styles`.

Workaround (VERIFIED for the import-time problem only by reasoning plus the failure above, not run inside Next): keep every module that imports `@a2ui/react` off the server. Options:
1. Put the A2UI rendering in a file that is only loaded on the client with `next/dynamic(() => import('./A2uiPanel'), {ssr: false})`.
2. Guard with `typeof window !== 'undefined'` before the import (dynamic `import()` inside `useEffect`), since a static import is evaluated at module load on the server.
3. Polyfill `HTMLElement` on the server. Not recommended.

---

## 5. Next.js 16 App Router and Vite compatibility

### Next.js 16 App Router
- The package has no `"use client"` directive anywhere in the React build (VERIFIED: `grep` finds `use client` only inside `.map` source maps). Any file that renders `A2uiSurface` must therefore carry `"use client"` itself, and must not be imported by a Server Component without that boundary.
- Next still renders client components on the server during SSR/prerender. Because of the `HTMLElement` ReferenceError above, a static import of `@a2ui/react` in a client component will crash the server render (VERIFIED for Node, ASSUMED for Next specifically, not run). Use `next/dynamic` with `ssr: false` for the surface component.
- CSS: the basic catalog injects its stylesheet at runtime into `document.adoptedStyleSheets` (VERIFIED in source), so no global CSS import is required for the standard catalog. CSS Modules work in Next (README claim, ASSUMED not run).
- `@a2ui/react/styles/structural.css` is a broken export (file missing). Do not import it.
- Peer conflicts: none with React 19.3.1 in the probe.
- Not tested: a real Next 16 build. ASSUMED that it behaves as above.

### Vite
- ESM-first with `exports` maps; `@a2ui/react` and `@a2ui/web_core` are plain ES modules, so Vite dev and build should resolve them (ASSUMED, not run).
- The `HTMLElement` import-time issue is irrelevant in the browser; Vite's SSR mode (`ssrLoadModule`) would hit it like Node does (ASSUMED).

---

## 6. Divergence between docs and the published package

1. **Quickstart (https://a2ui.org/quickstart/, VERIFIED via fetch):** header says "A2UI v1.0"; Specifications lists v1.0 (Current) and v0.9.1. Install is `npx skills add a2ui-project/a2ui`. The page contains no React code and names no npm packages. It points to a sample `samples/travel-a2ui` in an "A2UI Labs" repo with a catalog `catalogs/a2ui-travel/catalog.json`, a Python server, and renderers at `renderers/react/` and `renderers/flutter/`. The quickstart therefore describes v1.0, but the npm React package does not ship v1.0 (see section 3.8).
2. **GitHub `typescript/renderers/react` README (main branch, VERIFIED via fetch):** says "Renders A2UI v0.9, v0.9.1 and v1.0 surfaces from the same package" and "The processor accepts messages for every supported protocol version (v0.8, v0.9, v0.9.1 and v1.0)." The published 0.15.0 README says v0.9 native, v0.8 legacy, and has no v1.0 section, and the package has no `v1_0` export. **Main branch is ahead of the npm release.** Do not design against the GitHub README for v1.0.
3. **Published README vs CHANGELOG on the default export:** README says "While it remains the default export for the `@a2ui/react` package" for v0.8. CHANGELOG 0.13.0 says the root no longer re-exports v0.8 (BREAKING). The installed root (`index.d.ts`) exports only v0.9-era runtime symbols. README is stale on this point.
4. **README "Installation" says `yarn add @a2ui/react @a2ui/web_core`.** Fine, but explicit `@a2ui/markdown-it` install hits ERESOLVE (see section 1).
5. **README Quick Start's `A2uiSurface` example** (with `sampleAgentMessages` and `basicCatalog`) matches the probe behavior. The README example message uses `version: 'v0.9' as const`. Works.
6. **package.json `./styles/structural.css` export** points to a missing file (see section 2).
7. **Quickstart points to `/quickstart/agent.md`** (a prompt for coding agents), which we did not fetch. Not verified.
8. The README says the basic catalog "renders as W3C Custom Elements" and that "the basic catalog no longer server-renders" (CHANGELOG 0.13.0). This matches the test output, and means `renderToString` cannot produce the basic catalog markup. Only custom React components produce HTML in SSR, and only if the module loads (it does not, on Node, as shown).

---

## 7. Risks and open questions

- HIGH: `@a2ui/react` cannot be imported in a non-browser JS runtime (VERIFIED, Node 26). Any SSR framework needs the surface in a client-only, dynamically imported island.
- HIGH: v1.0 is not renderable with the React package 0.15.0. If the product targets v1.0 (the quickstart does), either pin to v0.9 (`@a2ui/react@0.15.0`, `@a2ui/react/v0_9`) or wait for a React v1.0 adapter (ASSUMED that one is coming; no evidence in npm). Check `npm view @a2ui/react versions` again before committing.
- MEDIUM: the react package is pre-1.0 (0.x) and has shipped breaking changes in almost every minor (0.13, 0.15). Pin exact versions.
- MEDIUM: markdown-it peer mismatch (0.2.2 expects web_core 0.14). Let `@a2ui/react` resolve it; expect `npm ls` warnings.
- LOW: `vitest` needs `IS_REACT_ACT_ENVIRONMENT` set for clean output; cosmetic.
- OPEN: a real Next 16 App Router build with `next/dynamic ssr:false` was not run. Vite build not run. Both ASSUMED.
- OPEN: Action dispatch from the processor listener was verified; the `outboundListener` / `callAgentFunction` RPC path (for agent-side functions) was not exercised.
- OPEN: the Button action `context` values (`{who: {path: '/title'}}`) were sent but the resolved context values in `ActionPayload.context` were not printed. Not verified.

---

## 8. Recommendations for vitrine-studio

1. Base on `@a2ui/react@0.15.0` with protocol v0.9 (`import ... from '@a2ui/react/v0_9'` and `@a2ui/web_core/v0_9`). Pin exact versions in `package.json` (no caret).
2. Do not depend on v1.0 rendering in React yet. Keep the message layer (`MessageProcessor` + `SurfaceModel`) separate from React so a future v1.0 adapter can replace only the view layer.
3. Render every A2UI surface from a client-only island (`"use client"` + `next/dynamic(..., {ssr: false})`), because importing the package on the server crashes.
4. Build the vitrine catalog as `new Catalog(<own URL>, '0.9', [...basicCatalog.components.values(), ...ourComponents], [...basicCatalog.functions.values()])`. Our custom components are created with `createComponentImplementation`.
5. Provide markdown via `MarkdownContext.Provider value={renderMarkdown}` from `@a2ui/markdown-it`.
6. Do not import `@a2ui/react/styles/structural.css`.
7. Local-AI relevance: none of this package code is model-specific. The processor only consumes JSON messages, so any local model that emits v0.9 envelopes can drive it (ASSUMED from the API shape; not tested with a model).

---

## 9. Probe files (all under scratchpad)

- `.../scratchpad/a2ui-probe/package.json`: deps as listed in section 1
- `.../scratchpad/a2ui-probe/tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`
- `.../scratchpad/a2ui-probe/vitest.config.mts`: includes `src/**/*.test.tsx`
- `.../scratchpad/a2ui-probe/src/probe.test.tsx`: tests (a) standard catalog and (b) custom component, both passing
- `.../scratchpad/a2ui-probe/src/v10.test.tsx`: v1.0 envelope rejection check
