# Canvas libraries for vitrine-studio (verified 2026-11-17)

Scope: three canvases.
1. UI canvas: palette -> page, nested sections/rows/columns/blocks (output becomes an A2UI component tree).
2. Architecture canvas: nodes (client, gateway, service, worker, queue, cache, DB, storage, external API, auth) + labelled edges.
3. Database canvas: ER diagram, table nodes with per-column handles and cardinality edges.

Verification legend: **VERIFIED (npm)** = `npm view` / installed package files. **VERIFIED (web)** = fetched primary page today. **VERIFIED (probe)** = compiled in the probe project. **ASSUMED** = not checked.

---

## 1. Package facts (npm registry, read 2026-11-17)

| Package | Latest | License | Last publish (`time.modified`) | Peer deps | Verdict |
|---|---|---|---|---|---|
| `@xyflow/react` | 13.0.1 | MIT | 2026-11-16 | react >=18, react-dom >=18, @types/react >=18, @types/react-dom >=18 | Active. Use for architecture and ER canvases. |
| `@dnd-kit/core` | 6.3.1 | MIT | 2024-12-05 | react >=16.8 | Maintenance mode. See the React 19 typing break below. |
| `@dnd-kit/sortable` | 10.0.0 | MIT | 2024-12-04 | `@dnd-kit/core ^6.3.0` | Tied to the old core. |
| `@dnd-kit/react` | 0.5.3 | MIT | 2026-10-31 | react ^18 \|\| ^19, react-dom ^18 \|\| ^19 | Rewrite of dnd-kit, React 19 declared. Recommended for the UI canvas. Pre-1.0. |
| `@dnd-kit/dom` | 0.5.3 | MIT | 2026-10-31 | none | Framework-agnostic core of the rewrite. |
| `@atlaskit/pragmatic-drag-and-drop` | 4.0.0 | Apache-2.0 | 2026-09-24 | not probed | ASSUMED: framework-agnostic, Atlassian-maintained. Not installed, so unverified for React 19 types. Fallback option. |
| `react-dnd` | 16.0.1 | MIT | 2022-06-25 | `@types/react >=16`, `react >=16.14` | Stale (no publish in ~4 years). Do not use. |
| `zustand` | 5.1.0 (installed). Note: `@xyflow/react@13.0.1` depends on `zustand ^5.0.15`. | MIT | 2026-11-06 | immer >=9.0.6 (optional), react >=18 | Use v5. |
| `zundo` | 2.3.0 | MIT | 2024-11-17 | `zustand ^4.3.0 \|\| ^5.0.0` | Temporal (undo/redo) middleware. Works with zustand 5. |
| `immer` | 11.2.10 | MIT | 2026-11-10 | none | Optional, for immutable updates of nested trees. |
| `@dbml/core` | 12.1.0 | Apache-2.0 | 2026-11-17 | not checked | DBML parser/exporter. Not installed (size). |
| `elkjs` | 0.12.1 | EPL-2.0 OR GPL-3.0-or-later (dual) | 2026-10-28 | none | Auto-layout (ELK). Pick EPL-2.0 for a permissive path. |
| `@dagrejs/dagre` | 3.1.3 | MIT | 2026-10-24 | none | Simple layered layout. Use it first for ER/architecture. |
| `tldraw` | 5.6.1 | Proprietary: "SEE LICENSE IN LICENSE.md" | 2026-11-17 | react ^18.2 \|\| ^19.2.1 | License key needed for production. See section 4. |
| `@excalidraw/excalidraw` | 0.18.1 | MIT | 2026-11-16 | react ^17.0.2 \|\| ^18.2 \|\| ^19 | MIT, React 19 declared. Not recommended for the wireframe canvas (section 4). |
| `typescript` | 7.0.2 (installed). Note: this is the native port; `tsc` ran fine. | Apache-2.0 | n/a | n/a | Used for checks. |

---

## 2. Probe: install and type-check (VERIFIED probe)

Project: `<scratchpad>/canvas-probe`

Installed (`npm install`, no peer conflicts reported):
```
react@19.3.1, react-dom@19.3.1, @xyflow/react@13.0.1, @dnd-kit/core@6.3.1,
@dnd-kit/sortable@10.0.0, @dnd-kit/react@0.5.3, zustand@5.1.0, zundo@2.3.0,
immer@11.2.10, @dagrejs/dagre@3.1.3; dev: typescript@7.0.2, @types/react@19.3.0, @types/react-dom@19.3.0
```

Results of `tsc --noEmit`:
- **React Flow sample** (`src/canvas.tsx`): compiles under `strict: true`. Custom `service` and `table` node types, per-column handles, native HTML5 palette drop with `screenToFlowPosition`. Exit 0 with the `@dnd-kit/react` sample in the same run.
- **`@dnd-kit/react` sample** (`src/dnd-kit-react-palette.tsx`): compiles under `strict: true`, no `skipLibCheck`. Exit 0.
- **`@dnd-kit/core` sample** (`core-check/src/dnd-kit-palette.tsx`): **FAILS under strict** with `TS2503: Cannot find namespace 'JSX'` in `@dnd-kit/core/dist/components/*.d.ts`. Passes only with `skipLibCheck: true`.
  - Cause (VERIFIED from `node_modules/@types/react/index.d.ts`): `@types/react` 19 nests `namespace JSX` inside `declare namespace React` (line ~4226). It is no longer a global. `@dnd-kit/core` 6.3.1 (last published 2024-12) references a bare global `JSX`.
  - `@dnd-kit/react` 0.5.3 types its JSX via `react_jsx_runtime.JSX.Element`, so it does not have this problem.

Other probe findings (all VERIFIED from installed `.d.ts`):
- **React Flow 13 API change.** `applyNodeChanges` / `applyEdgeChanges` are NOT exported from `@xyflow/react` 13.0.1. `onNodesChange` receives a `NodeChangeset` (class from `@xyflow/system`), not an array. Use `useNodesState` / `useEdgesState`, which return `[items, setItems, onChange]`. Older v12 snippets that call `applyNodeChanges(changes, nodes)` will not compile.
- **CSS side-effect import.** `import '@xyflow/react/dist/style.css'` needs a module declaration under TS 7 (`declare module '@xyflow/react/dist/style.css';`). The `package.json` exports map does include `./dist/style.css`.
- `screenToFlowPosition` is on `useReactFlow()`. Its d.ts comment reads "`project` was renamed to `screenToFlowPosition`".
- `toObject()` returns `ReactFlowJsonObject<NodeType, EdgeType>` (nodes, edges, viewport) for serialization.

### Working sample: React Flow (architecture + ER), palette drop, per-column handles

Verbatim from the probe (`src/canvas.tsx`, abridged where marked):

```tsx
import { useCallback, type DragEvent } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position,
  addEdge, useNodesState, useEdgesState, useReactFlow,
  type Node, type NodeProps, type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

type ServiceData = { label: string; kind: 'service' | 'database' | 'queue' };
type ServiceNode = Node<ServiceData, 'service'>;

function ServiceNodeView({ data }: NodeProps<ServiceNode>) {
  return (
    <div style={{ border: '1px solid #444', borderRadius: 6, padding: 8, background: '#fff' }}>
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong> <small>({data.kind})</small>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

type Column = { name: string; type: string; pk: boolean };
type TableData = { name: string; columns: Column[] };
type TableNode = Node<TableData, 'table'>;

function TableNodeView({ data }: NodeProps<TableNode>) {
  return (
    <div style={{ border: '1px solid #222', background: '#fff', minWidth: 180, fontSize: 12 }}>
      <div style={{ background: '#222', color: '#fff', padding: 4 }}>{data.name}</div>
      {data.columns.map((c) => (
        <div key={c.name} style={{ position: 'relative', padding: '3px 8px' }}>
          <Handle id={`${c.name}-in`} type="target" position={Position.Left} />
          {c.pk ? 'PK ' : ''}{c.name} <span style={{ color: '#666' }}>{c.type}</span>
          <Handle id={`${c.name}-out`} type="source" position={Position.Right} />
        </div>
      ))}
    </div>
  );
}

type AnyNode = ServiceNode | TableNode;
const nodeTypes = { service: ServiceNodeView, table: TableNodeView };
const PALETTE_MIME = 'application/x-vitrine-node';

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<AnyNode>([
    { id: 'users', type: 'table', position: { x: 0, y: 0 },
      data: { name: 'users', columns: [{ name: 'id', type: 'uuid', pk: true }, { name: 'email', type: 'text', pk: false }] } },
  ]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(PALETTE_MIME);
    if (!raw) return;
    const item = JSON.parse(raw) as { type: 'service'; label: string };
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const node: ServiceNode = { id: crypto.randomUUID(), type: 'service', position,
      data: { label: item.label, kind: 'service' } };
    setNodes((ns) => [...ns, node]);
  }, [screenToFlowPosition, setNodes]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((es) => addEdge({ ...conn, label: 'HTTP' }, es)),
    [setEdges],
  );

  return (
    <div style={{ display: 'flex', height: 480 }}>
      {/* palette: <div draggable onDragStart={e => e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(it))}> */}
      <div style={{ flex: 1 }} onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow<AnyNode, Edge>
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          onConnect={onConnect} fitView>
          <Background /><Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
// Wrap with <ReactFlowProvider> at the top (required for useReactFlow outside <ReactFlow>).
```

Official drag-and-drop example (VERIFIED web, https://reactflow.dev/examples/interaction/drag-and-drop): the onDrop handler calls `event.preventDefault()`, returns early without a type, computes `screenToFlowPosition({ x: event.clientX, y: event.clientY })`, and appends with `setNodes((nds) => nds.concat(newNode))`. `onDragOver` sets `dropEffect = 'move'`. The example's imports include `useNodesState`, `useEdgesState`, `addEdge`, `useReactFlow`, `ReactFlowProvider`. The example's own palette source is a sidebar of `draggable` divs with `onDragStart`.

### Working sample: @dnd-kit/react (UI canvas palette -> drop zone, sortable)

Verbatim from the probe (`src/dnd-kit-react-palette.tsx`):

```tsx
import type { ReactNode } from 'react';
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';

type PaletteItem = { kind: 'row' | 'card' | 'button' | 'text' };

function PaletteButton({ item }: { item: PaletteItem }) {
  const { ref, isDragging } = useDraggable({ id: `palette-${item.kind}`, data: item });
  return <button ref={ref} style={{ opacity: isDragging ? 0.5 : 1 }}>{item.kind}</button>;
}

function PageDropZone({ children }: { children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id: 'page-root' });
  return <div ref={ref} style={{ minHeight: 160, outline: isDropTarget ? '2px solid #0a0' : 'none' }}>{children}</div>;
}

function SortableBlock({ id, index, label }: { id: string; index: number; label: string }) {
  const { ref, isDragging } = useSortable({ id, index, group: 'page-root' });
  return <div ref={ref} style={{ opacity: isDragging ? 0.6 : 1 }}>{label}</div>;
}

export function PaletteDnd() {
  const items: PaletteItem[] = [{ kind: 'row' }, { kind: 'card' }, { kind: 'button' }, { kind: 'text' }];
  const blocks = ['Hero', 'Features'];
  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        console.log('drop', event.operation.source?.id, '->', event.operation.target?.id);
      }}
    >
      {items.map((it) => <PaletteButton key={it.kind} item={it} />)}
      <PageDropZone>
        {blocks.map((b, i) => <SortableBlock key={b} id={b} index={i} label={b} />)}
      </PageDropZone>
    </DragDropProvider>
  );
}
```

Not verified: nested sortable containers (a row containing columns containing blocks) with `@dnd-kit/react`. The probe only covers one flat group. This is the main risk of the UI canvas and must be prototyped before committing.

---

## 3. Library-by-library assessment

### 3.1 Drag and drop: which to use

- **`@dnd-kit/react` 0.5.3 (recommended).** MIT, React 19 declared, types compile under strict mode without `skipLibCheck`. Hooks `useDraggable`, `useDroppable`, `useSortable` (`@dnd-kit/react/sortable`). Callback refs (`ref`, `handleRef`), so no DOM-node juggling. Pre-1.0: API may still change. The rewrite was published 2026-10-31, so it is fresh.
- **`@dnd-kit/core` 6.3.1 + sortable 10.** Mature, but last published 2024-12. Breaks strict type-check with `@types/react` 19 unless `skipLibCheck` is set. Avoid for a new React 19 project.
- **`@atlaskit/pragmatic-drag-and-drop` 4.0.0 (Apache-2.0, published 2026-09-24).** Strong fallback for nested trees (Atlassian uses it in production). NOT probed, so React 19 type compatibility and the nested-tree API are ASSUMED. Worth a 30-minute spike if `@dnd-kit/react` nested sortable fails.
- **`react-dnd` 16.0.1.** Stale since 2022. Reject.
- **Native HTML5 DnD.** Used in the React Flow sample for palette -> canvas drop (no lib). Works, and is fine for palette -> one drop target. Not enough for sortable reordering in nested trees. Testing: Playwright `dragTo` works for HTML5 DnD in Chromium; jsdom does NOT implement DataTransfer/drag events, so unit tests need a helper that dispatches `dragstart`/`drop` with a stub `DataTransfer`, or use Playwright only. ASSUMED based on known jsdom limits; not run here.
- Testability: `@dnd-kit` pointer sensors work with Playwright `mouse` APIs; with jsdom, rely on the logic functions (tree-move functions) rather than the gestures.

### 3.2 @xyflow/react 13.0.1 (architecture + ER)

- License MIT. Verified (npm).
- React 19: peers allow >=18. Probe compiled and typed against React 19.3.1. VERIFIED (probe).
- **Custom nodes with multiple handles:** verified in probe. Each `<Handle id="...">` is addressed by `sourceHandle` / `targetHandle` on the edge. Per-column handles for ER work as shown.
- **Edge labels:** `addEdge({ ...conn, label: 'HTTP' })` in the probe. For cardinality (1:N, N:M), use a custom edge type or the built-in `label` plus `markerStart` / `markerEnd`. Marker support: `MarkerType` is exported (VERIFIED in `index.d.ts` export list).
- **Drag from palette:** official pattern verified (section 2).
- **Serialization:** `toObject()` returns `{ nodes, edges, viewport }`. Store the node `data` (not the rendered JSX). Node and edge arrays are plain JSON.
- **Auto-layout:** dagre (`@dagrejs/dagre` 3.1.3, MIT) is simplest for ER and architecture. elkjs 0.12.1 is more capable but dual-licensed (EPL-2.0 / GPL-3.0); choose EPL-2.0 deliberately. ASSUMED: integration examples exist in the React Flow docs ("Layouting" guide); not fetched.
- **CSS:** `import '@xyflow/react/dist/style.css'` (VERIFIED: export exists in package exports). Needs a `*.css` module declaration under strict TS (see probe).
- **SSR (Next 16):** React Flow components use browser APIs (ResizeObserver, pointer events). Render the canvas from a client component (`'use client'`), and do not server-render the canvas body. ASSUMED standard practice; not tested in Next 16 here.
- **Performance:** keep node `data` referentially stable; memoize custom node components (`React.memo`) and handle lists. ASSUMED standard guidance; not benchmarked.

### 3.3 tldraw (VERIFIED web: https://tldraw.dev/community/license)

- Production requires a license key. The SDK "runs in production only with a valid key". Default terms: development use.
- Hobby license: non-commercial, requested by form, **requires a "made with tldraw" watermark** on the canvas.
- Trial: free 100-day trial license, one per commercial unit; the SDK sends a hash of the license key to tldraw servers during the trial.
- Commercial: sales form; "startup pricing may be available". No price is published on that page (pricing page is separate; not fetched).
- Verdict for vitrine-studio: a commercial product needs a paid commercial license. Do not use tldraw as the wireframe canvas unless the budget and the license are approved. Its `"SEE LICENSE IN LICENSE.md"` license field confirms it is not open source.

### 3.4 Excalidraw (`@excalidraw/excalidraw` 0.18.1, MIT, React 19 peer declared, VERIFIED npm)

- Free to use in commercial products under MIT (VERIFIED npm license field).
- Why not as the wireframe canvas: it is a freehand whiteboard. Its shapes are sketch primitives, not a component tree. The output must be an A2UI component tree (Column/Row/Card/Text/Button), so an Excalidraw scene would need a lossy conversion. ASSUMED based on the library's data model; not probed.

### 3.5 Make-real: prior art for "Reimaginar"

- Source of truth: the tldraw `make-real-starter` repo (https://github.com/tldraw/make-real-starter), found by search today. The `tldraw.dev/blog/make-real` URL returned 404 (VERIFIED web), so the blog post is not cited as a primary source here.
- How it works (from search excerpts of the official repo and the tldraw write-up, SECONDARY, not fully read):
  1. The user draws a mockup on the tldraw canvas and selects it.
  2. The app captures an image of the selection (PNG, base64). It is a screenshot of the selected shapes only.
  3. The image plus a system prompt are sent to a vision model (GPT-4V at launch, Nov 2023).
  4. The model returns one self-contained HTML file (inline CSS and JS).
  5. The HTML is shown in an iframe inside a custom tldraw shape on the canvas.
  6. Iteration: the previous HTML is sent back with the new drawing, asking the model to fill the box.
- Lesson for vitrine-studio: make-real is image-in, HTML-out, with no intermediate structure. Our version should send **structured JSON** (the canvas component tree) to the model, not a screenshot, and ask for an **A2UI JSON** response. That makes the output deterministic to validate and re-render. A screenshot can be added as an optional extra input. ASSUMED design rationale.

### 3.6 Zustand / Zundo / Immer

- Zustand 5.1.0 (MIT). Use as the canvas store. React 18+ peer. Installed and used with the probe's versions.
- Zundo 2.3.0 (MIT): temporal middleware for undo/redo. Peer `zustand ^4.3.0 || ^5.0.0`. Compatible with zustand 5. Last publish 2024-11-17: stable, not actively updated. Usage: `temporal(store)` with `partialize` to track only the tree, not selection/UI state. ASSUMED usage pattern; not run.
- Persist middleware: part of `zustand/middleware` in zustand 5.1.0 (ASSUMED present; not checked against the installed package).
- Immer 11.2.10 (MIT): optional, for nested tree updates. Zustand also supports the `immer` middleware (`zustand/middleware/immer`); peer `immer >=9.0.6` is optional.

### 3.7 Prior art for diagram-to-code and ERD-to-schema (ASSUMED unless marked)

These were NOT fetched in this session except where noted. Treat as a checklist to verify before adopting.

| Tool | Intermediate format | Relevance |
|---|---|---|
| DBML (dbdiagram.io) | DBML text | Human-readable schema language. `@dbml/core` 12.1.0, Apache-2.0 (VERIFIED npm). Good import/export target for ERD. |
| Prisma schema | `schema.prisma` | Target for ERD -> ORM schema export. |
| ChartDB / drawDB | Own JSON, SQL export | Open-source ER editors; check license before reuse. |
| Azimutt | Own JSON, DB introspection | Strong ERD and import from live DB. |
| Eraser | DSL (diagram-as-code) | Diagram-as-text. Reference only. |
| AWS Application Composer | CloudFormation/SAM templates | Architecture -> IaC. Reference for the architecture canvas output. |
| Encore Flow / Wing | Code-first | Architecture from code, opposite direction. Reference only. |

Recommendation for formats: import/export **DBML** for the database canvas (text, diffable, parser exists), and **Prisma schema** as a code-generation target. For architecture, define our own JSON (nodes + typed edges), and export a deployment or scaffold manifest later. Not verified: whether `@dbml/core` supports full ref/cardinality round-trip; check its README before committing.

---

## 4. Recommendation per canvas

### UI canvas: structured tree editor, not React Flow

Reason: the output must be an A2UI component tree (Column, Row, Card, Text, Button, ...). A UI canvas is a nested container tree with ordered children, and the drag operation is "move subtree into slot". React Flow models a graph of nodes and edges with free positions. Using it for layout means positions must be converted to a tree, which is lossy and fights the model. The structure you save is the tree itself.

- Build: a plain React tree editor over the canonical JSON tree (`{ id, component, props, children }`), with `@dnd-kit/react` for palette -> slot and sortable within a slot.
- Optional free-form wireframe boxes: a second mode that lays out absolute boxes (a "wireframe" frame). Convert to a Row/Column tree on export (ASSUMED; a heuristic, not built).
- Undo/redo: Zustand + zundo over the tree.
- Risk: nested `@dnd-kit/react` sortable not verified. Spike before committing. Fallback: `@atlaskit/pragmatic-drag-and-drop`.

### Architecture canvas: React Flow (`@xyflow/react` 13.0.1)

Fit: nodes + labelled directed edges + free layout is exactly React Flow. Custom node types per component kind, edge labels for protocol (HTTP, gRPC, event, reads/writes). Serialize with `toObject()`. Auto-layout with dagre.

### Database canvas: React Flow (`@xyflow/react` 13.0.1)

Fit: table nodes with per-column handles (verified), relation edges with cardinality markers. Serialize tables/columns/PK/FK as JSON, and export DBML (`@dbml/core`) and Prisma schema.

### One library for all three?

**No.** React Flow can draw all three, but the UI canvas does not fit a graph model. Use React Flow for architecture and database (both are graphs), and a structured tree editor with `@dnd-kit/react` for the UI canvas (a tree). Sharing the rendering/store layer (Zustand + zundo) across the three is the reuse point, not the canvas library.

---

## 5. Open risks and next steps

1. Spike nested sortable in `@dnd-kit/react` 0.5.3 (row > column > blocks, drop between siblings). If it fails, switch to `@atlaskit/pragmatic-drag-and-drop`, which was not probed.
2. Pin `@dnd-kit/react` to exact `0.5.3` (pre-1.0; API churn likely).
3. Check the React Flow Next 16 integration (client-only canvas) in a real app. Not done here.
4. Confirm `@dbml/core` round-trip for refs and cardinality before promising DBML import.
5. tldraw: only with a commercial license decision. Current recommendation: do not use.
6. Playwright tests for drag (Chromium HTML5 DnD + dnd-kit pointer). jsdom cannot test native drag events; unit-test the tree operations instead. ASSUMED; not run.

## 6. Sources and probe paths

- npm registry: `npm view <pkg> version license time.modified peerDependencies` (run 2026-11-17).
- tldraw license: https://tldraw.dev/community/license (VERIFIED web).
- React Flow drag-and-drop example: https://reactflow.dev/examples/interaction/drag-and-drop (VERIFIED web).
- make-real starter: https://github.com/tldraw/make-real-starter (search excerpts only, SECONDARY).
- Failed fetch: https://tldraw.dev/blog/make-real returned 404.
- Probe project: `<scratchpad>/canvas-probe`
  - `src/canvas.tsx` (React Flow sample, strict OK)
  - `src/dnd-kit-react-palette.tsx` (@dnd-kit/react sample, strict OK)
  - `core-check/src/dnd-kit-palette.tsx` (@dnd-kit/core sample, strict fails, skipLibCheck passes)
