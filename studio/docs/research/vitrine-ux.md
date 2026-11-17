# vitrine-ia: UX / product patterns to draw from (read-only study)

Source studied: `~/Projetos/Vitrine/vitrine-ia` (read-only, not modified).
Legend: **VERIFIED (how)** = read in source/screenshot or checked in node_modules. **ASSUMED** = inferred or from general knowledge, not checked.

Installed versions (VERIFIED from `node_modules/*/package.json`): `tailwindcss` 4.3.5, `ai` 7.0.173. Declared in `package.json` (not checked against lockfile): `next` ^16.4.6, `react` ^19.3.1, `motion` ^14.14.0, `@babel/standalone` ^7.27.6, `@monaco-editor/react` ^4.7.0, `zod` ^4.1.8, `prisma`/`@prisma/client` ^6.10.1, `lucide-react` ^0.517.0, `react-resizable-panels` ^3.0.3, `jose` ^6.0.11, `bcrypt` ^6.0.0.

---

## 0. TL;DR for the new project

- The reference is a **single-screen, three-panel app**: chat/agent timeline (left) | preview or code (right) | Design Review as an overlay drawer. The new product maps well onto it as **palette | canvas | inspector** on the left/center and **timeline + review drawer** on the right.
- The reusable gems are: the **agent timeline** (a pure function turns tool parts into steps), the **Design Review** pattern (zod-validated structured object, score ring + issue cards + JSON + "copy as issues"), the **dark "app-bg" + violet/fuchsia/amber gradient identity**, the **3-panel resizable shell**, and the **in-browser preview** idea.
- Do NOT copy: the server-side virtual FS that the client re-applies (double execution), Prisma/SQLite JSON blobs with JWT auth for a v1, the Babel+CDN preview as a production export path, and the hardcoded Portuguese/landing-page-specific copy.
- Recommendation: **start local-first** (IndexedDB + a versioned JSON project file + export/import). Only add a server/auth layer when sharing is needed.

---

## 1. Product flow and layout

### 1.1 Current app flow (VERIFIED: `src/app/main-content.tsx`, `src/components/chat/*`, screenshots 01/04/05/06/08)

1. **Empty state** (`ChatInterface.tsx` `EmptyState`): pill "IA gerando código ao vivo", headline "Landing pages que vendem, em segundos." (last words in gradient text), subtitle explaining the loop, then a 2x2 grid of **example prompts** (`ExamplePrompts.tsx`: Cafeteria, Salão de beleza, Personal trainer, Pizzaria; each = emoji + label + prompt, click sends immediately).
2. **Prompt input** (`MessageInput.tsx`): auto-growing textarea (min 84px, max 200px), Enter sends, Shift+Enter newline, round gradient send button, hint line "Enter envia · Shift+Enter quebra linha". Note: no stop button is rendered even though `stop` exists in `chat-context.tsx` (VERIFIED: MessageInput has no stop control).
3. **Agent timeline** (`MessageList.tsx` + `agent-steps.ts`): a vertical `<ol class="timeline">` with a 1px gradient spine (`.timeline::before` in globals.css). Each node is a 24px circle icon + content:
   - `reasoning` part → collapsed `<details>` "Reasoning"
   - `text` part → sparkle node with the streamed text (word-by-word `token-in` spans while streaming, then Markdown)
   - `step-start` (after the first) → "LOOP · PASSO n" node with a rotate icon
   - tool part → **tool card**: verb + monospace target + tool-name chip. Verbs come from `VERBS` map: `create` = "criando"/"criou", `str_replace` = "editando"/"editou", `view` = "lendo"/"leu", `insert`, `undo_edit`, `rename` = "movendo", `delete` = "apagando", `list`. States: running (spinner, violet shimmer border), done (green check), error, **interrupted** (token limit: "interrompido").
   - trailing node: shimmering "pensando…" / "trabalhando…" while live; then "**pronto** · 8 passos · 13 tool calls" (VERIFIED in screenshot 06).
   - Pure function `toolPartToStep(part, live)` in `agent-steps.ts` is testable and explicitly written "para explicar em aula" (VERIFIED in source comments).
4. **Right panel** (`main-content.tsx`): a rounded window card (`rounded-2xl border bg-zinc-900/60 shadow-2xl`) with traffic-light dots, a segmented **Preview | Código** switch (`motion.span layoutId="view-pill"` spring pill), and the **Design Review** button top-right (white pill; disabled until a .jsx/.tsx file exists; label switches to "Revisando…" with spinning icon).
5. **Code view** (`FileTree.tsx` + `CodeEditor.tsx` in a nested `ResizablePanelGroup`, 28%/72%): folders first, violet folder icons, selected row `bg-violet-500/15`. Monaco `vs-dark`, minimap off, wordWrap on, padding 16px. Edits go to the client FS (`updateFile`) but are **not** saved to the server (see §4).
6. **Design Review drawer** (`ReviewPanel.tsx`): absolutely positioned `motion.aside` sliding from the right inside the preview card, max 440px wide, `bg-zinc-950/95 backdrop-blur-xl`, spring `stiffness 260 damping 30`. Shows loading skeleton ("analisando hierarquia, cor, estados…"), error alert, or result. Preview stays visible behind it (screenshot 05).
7. **Header** (`HeaderActions.tsx`): project switcher (cmdk popover with search), "New Design" button, sign-out icon; anonymous users see Sign In / Sign Up. `ProviderBadge` (`brand/ProviderBadge.tsx`) shows `provider · modelId` with a pinging colored dot and turns red when `info.error` is set (missing key) — a good "config is visible" pattern.

Screenshot sequence (VERIFIED by viewing PNGs in `docs/aula1/screens/`):
- `01-app-vazio.png`: empty state above; right side shows a grey skeleton wireframe "O preview aparece aqui, ao vivo" with copy "Cada arquivo que a IA cria no sistema de arquivos virtual re-renderiza este iframe."
- `04-timeline-tools.png`: user bubble (violet→fuchsia gradient, right aligned, `rounded-2xl rounded-br-md`), then tool cards "criando /App.jsx", "criando /components/Navbar.jsx" with spinners; preview still a blank white page.
- `05-preview.png`: generated coffee landing (dark photo hero, amber CTA) at left of the card, Design Review drawer at right showing score ring **68 de 100** (amber ring), summary paragraph, "6 ISSUES" header with JSON and "issues" buttons, first issue card "MÉDIA · accessibility · /components/Navbar.jsx" with title and suggestion. Timeline shows "LOOP · PASSO 2" where the model removed an inline `style` to respect the Tailwind-only rule (self-correction visible in the timeline).
- `06-codigo-gerado.png`: Código view with folder tree (components/…, App.jsx selected) and Monaco showing the generated App.jsx.
- `08-review-resultado.png`: the finished landing (Torra Alta, coffee shop, amber/orange CTA, "Reservar mesa", floating "Cold brew de laranja R$ 16,00" card, 4.9 stars) with the Design Review button active.

### 1.2 Mapping onto the new product (canvas + palette + inspector + "Reimaginar" + preview + export)

| Reference idea | New-product equivalent |
|---|---|
| Chat panel with example chips | **Palette** (components to drag) + "starter templates" chips in the empty canvas state |
| Chat input | Replaced by canvas: drag components, edit props in **Inspector** (right) |
| Agent timeline (tool cards, "LOOP · PASSO n", "pronto · N passos") | **Reimaginar run log**: each step = "criando Hero", "ajustando CTA", with the same states (running/done/interrupted) |
| Preview card with Preview/Código switch | Canvas (edit) / Preview (rendered) / Code (export) switch, same segmented control |
| Design Review drawer | Review drawer for the active target: landing surface, architecture graph, DB schema (see §5) |
| ProviderBadge (`provider · model`, red on error) | Same badge: shows whether "Reimaginar" runs on cloud or **local** model |
| Export | Export tab (JSON project file, rendered HTML/React code) |

Layout recommendation (ASSUMED design, derived from reference): keep `ResizablePanelGroup` horizontal with three panels: palette 18–22% | canvas 50–60% | inspector/timeline 22–28%, with the review drawer as an overlay (it worked well in the reference because the preview stays visible behind it).

---

## 2. Visual identity (exact tokens)

### 2.1 Tokens from `src/app/globals.css` (VERIFIED)

Base: Tailwind v4 + shadcn "neutral" tokens in **oklch**, but the app forces dark mode and mostly uses hardcoded Tailwind palette classes (zinc / violet / fuchsia / amber / rose / emerald / sky).

`:root` (light, shadcn neutral):
```
--radius: 0.625rem;            /* 10px */
--background: oklch(1 0 0);    --foreground: oklch(0.145 0 0);
--card: oklch(1 0 0);          --primary: oklch(0.205 0 0);
--secondary: oklch(0.97 0 0);  --muted: oklch(0.97 0 0);
--muted-foreground: oklch(0.556 0 0);
--destructive: oklch(0.577 0.245 27.325);
--border: oklch(0.922 0 0);    --input: oklch(0.922 0 0);  --ring: oklch(0.708 0 0);
--chart-1: oklch(0.646 0.222 41.116);  --chart-2: oklch(0.6 0.118 184.704);
--chart-3: oklch(0.398 0.07 227.392);  --chart-4: oklch(0.828 0.189 84.429);
--chart-5: oklch(0.769 0.188 70.08);
--sidebar*: neutral set
```
`.dark` (the one actually used; `<html class="dark">` in `layout.tsx`):
```
--background: oklch(0.145 0 0);   --foreground: oklch(0.985 0 0);
--card: oklch(0.205 0 0);         --primary: oklch(0.922 0 0);
--secondary/--muted/--accent: oklch(0.269 0 0);
--muted-foreground: oklch(0.708 0 0);
--destructive: oklch(0.704 0.191 22.216);
--border: oklch(1 0 0 / 10%);     --input: oklch(1 0 0 / 15%);
--chart-1: oklch(0.488 0.243 264.376);  --chart-2: oklch(0.696 0.17 162.48);
--chart-3: oklch(0.769 0.188 70.08);    --chart-4: oklch(0.627 0.265 303.9);
--chart-5: oklch(0.645 0.246 16.439);
```
Radius scale (`@theme inline`): `--radius-sm: calc(var(--radius) - 4px)` (6px), `-md` (8px), `-lg` (10px), `-xl` (14px). In practice the UI uses `rounded-xl` (12px), `rounded-2xl` (16px), `rounded-3xl` (24px), `rounded-[10px]`, `rounded-full`.

App background (the signature look), `.app-bg`:
```
background:
  radial-gradient(1200px 600px at -10% -20%, rgb(139 92 246 / 0.18), transparent 60%),  /* violet */
  radial-gradient(900px 500px at 110% 0%,  rgb(236 72 153 / 0.10), transparent 60%),   /* pink */
  radial-gradient(800px 600px at 50% 120%, rgb(251 191 36 / 0.08), transparent 60%),   /* amber */
  #09090b;   /* zinc-950 */
```
Used as `class="app-bg dark ..."` on the root `div` in `main-content.tsx`. `body` background comes from `@layer base { body { @apply bg-background text-foreground } }`.

Signature colors used in components (VERIFIED by grep of class names in components):
- Brand gradient: `from-violet-500 via-fuchsia-500 to-amber-400` (logo tile), user bubble `from-violet-500 to-fuchsia-500`, send button `from-violet-500 to-fuchsia-500`, hero headline gradient `from-violet-300 via-fuchsia-300 to-amber-200` (text clip).
- Problem/alert: `rose-400/500`; warning: `amber-*`; success: `emerald-300/400`; info: `sky-*`; accent for agent: `violet-300/400/500`.
- Borders/surfaces: `border-white/10`, `border-white/[0.06]`, `bg-white/[0.03]`, `bg-white/5`, `bg-zinc-900/60`, `bg-zinc-950/40`. Text: `text-white` headings, `text-zinc-400/500` secondary.
- Review score colors (`ReviewPanel.tsx` `scoreColor`): >=85 `#34d399` (emerald-400), >=65 `#fbbf24` (amber-400), else `#fb7185` (rose-400).
- Severity pills: high = `bg-rose-500/15 text-rose-300 border-rose-400/30`; medium = `bg-amber-500/15 text-amber-200 border-amber-400/30`; low = `bg-sky-500/15 text-sky-300 border-sky-400/30`.
- Provider dots (`ProviderBadge.tsx`): anthropic `bg-orange-400`, google `bg-sky-400`, groq `bg-rose-400`, openrouter `bg-violet-400`, mock `bg-zinc-400`.
- Window chrome dots: `bg-rose-400/70`, `bg-amber-400/70`, `bg-emerald-400/70`.
- Code editor background `#1e1e1e` (Monaco vs-dark).

### 2.2 Typography (VERIFIED in source; visual match ASSUMED)

- `layout.tsx`: `Geist` and `Geist_Mono` via `next/font/google`, exposed as `--font-geist-sans` / `--font-geist-mono`; `@theme inline` maps `--font-sans` and `--font-mono` to them. `<html lang="pt-BR" className="dark">`.
- Headline weights: `font-black` (900) with `tracking-tight` (`text-3xl font-black leading-tight tracking-tight`). Logo title `text-[15px] font-black`. Tagline `text-[10px] text-zinc-500`.
- Mono is used for paths, model ids, badges (`font-mono text-[11px]`, `text-[12px]` for targets).
- Small caps labels: `text-[11px] font-medium uppercase tracking-widest text-zinc-500` ("LOOP · PASSO n"); score label `text-[10px] uppercase tracking-widest`.
- Note: the screenshots look like Inter-style sans rather than Geist; ASSUMED that the rendering uses Geist fallback or a system font, not checked.

### 2.3 Tailwind v4 + shadcn setup (VERIFIED)

- `src/app/globals.css` starts with:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));
```
- Tokens are defined via `@theme inline { --color-background: var(--background); ... }` (CSS-first config, no `tailwind.config.js`).
- PostCSS: `postcss.config.mjs` exists; `devDependencies` includes `@tailwindcss/postcss ^4` (file contents not read; ASSUMED standard `@tailwindcss/postcss` plugin).
- `components.json` (VERIFIED):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```
- Installed shadcn-style primitives in `src/components/ui/`: button, command, dialog, input, label, popover, resizable, scroll-area, separator, tabs. Radix packages: dialog, label, popover, scroll-area, separator, slot, tabs. `cmdk` for the palette-style search. `react-resizable-panels` ^3.0.3 for the panels (its `resizable.tsx` wraps it).
- Utils: `cn` in `src/lib/utils.ts` (clsx + tailwind-merge; ASSUMED standard, not opened).
- Plugins: `@tailwindcss/typography` (for Markdown `prose prose-invert`), `tw-animate-css`.

### 2.4 Motion usage (VERIFIED)

Library: `motion/react` (package `motion` ^14.14.0; import path `motion/react`).
- Enter animation for messages and nodes (`MessageList.tsx`): `initial {opacity 0, y 8, blur 4px}` → `{opacity 1, y 0, blur 0}`, `spring stiffness 380 damping 30`.
- Empty-state headline: spring `stiffness 200 damping 24`; example cards stagger `delay 0.25 + i*0.08`, `whileHover y -2`, `whileTap scale 0.97`.
- Segmented control pill: `layoutId="view-pill"`, spring `stiffness 400 damping 32`.
- Review score ring: `useMotionValue` + `animate(value, score, {duration 1.2, ease [0.2,0.8,0.2,1]})` mapped to `strokeDashoffset` via `useTransform`; number counts up through `value.on("change")`. Stroke `drop-shadow` glow in score color.
- Review issue cards: `staggerChildren 0.09`, `delayChildren 0.25`, each card slides in from x 24 with spring `stiffness 300 damping 26`.
- Drawer: `x: "100%"` → 0, spring `stiffness 260 damping 30`.
- CSS-only effects (globals.css): `.token-in` (0.45s fade + blur per streamed word), `.caret` (steps(2) blink), `.shimmer-text` (1.8s gradient sweep), `.skeleton` (1.6s), `.shimmer-border`, `.glow-ring:focus-within` (violet glow), `@keyframes shine` on logo tile. `@media (prefers-reduced-motion: reduce)` disables token-in, caret, shimmer, skeleton, shimmer-border (VERIFIED). It does not disable motion/react springs (ASSUMED gap).

### 2.5 Components.json / UI chrome summary to copy

- Panel "window card" = `relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 shadow-2xl shadow-black/50` with a 48px header row.
- Primary CTA on dark = white pill with `text-zinc-950` and violet glow (`ReviewButton`): `rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-zinc-950 shadow-lg shadow-violet-900/30 hover:-translate-y-0.5 active:scale-95`; disabled = `bg-white/10 text-zinc-500`.
- Ghost/outline buttons: `border border-white/10 text-zinc-400 hover:text-white`.

---

## 3. Live preview mechanism

### 3.1 How it works (VERIFIED: `src/lib/transform/jsx-transformer.ts`, `src/components/preview/PreviewFrame.tsx`, `src/lib/contexts/file-system-context.tsx`)

Pipeline, each time `refreshTrigger` changes (every FS mutation):
1. `PreviewFrame` calls `getAllFiles()` (Map path→content) and picks an entry point: `/App.jsx`, `/App.tsx`, `/index.jsx`, `/index.tsx`, `/src/App.jsx`, `/src/App.tsx`, else the first `.jsx/.tsx` file.
2. `createImportMap(files)`:
   - For each `.js/.jsx/.ts/.tsx`: `transformJSX` = **Babel standalone** (`@babel/standalone`) with presets `["react", {runtime: "automatic"}]` plus `typescript` for TS files. Strips CSS `import './x.css'` lines first and collects them.
   - Each transformed module becomes a **Blob URL** (`URL.createObjectURL(new Blob([code], {type:"application/javascript"}))`).
   - Import map entries are added for `"/App.jsx"`, `"App.jsx"`, `"/App"`, `"App"`, `"@/App"`, `"@/App.jsx"`, etc. (every alias variant).
   - Third-party imports (no `.`, `/`, `@/` prefix) map to `https://esm.sh/<pkg>`. React itself is pinned: `react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, `react/jsx-dev-runtime` → `https://esm.sh/react@19` etc.
   - Local imports that don't exist become a **placeholder module** (`createPlaceholderModule`: a component rendering an empty `<div>`), silently. So a missing `@/components/Hero` renders blank rather than erroring.
   - CSS files are concatenated into a `<style>`; `.css` imports that don't exist add a comment only.
   - Returns `{ importMap: JSON string, styles, errors[] }`. Syntax errors go to `errors[]` and that file is skipped.
3. `createPreviewHTML(entry, importMap, styles, errors)` builds a full HTML document:
   - `<script src="https://cdn.tailwindcss.com">` (Tailwind **Play CDN**) plus an inline `tailwind.config` that extends keyframes/animations: `fade-up`, `fade-in`, `scale-in`, `float`, `gradient-x`, `marquee`, `shimmer` (these names are also listed in the generation prompt, so the model knows them).
   - `<script type="importmap">` with the JSON.
   - If there are syntax errors: renders a red HTML panel ("Syntax Error (n)") listing path, parsed `(line:col)` badge and message, and **does not mount React**. Otherwise a `<div id="root">` and a module script that dynamic-imports the entry blob, wraps `App` in an `ErrorBoundary` class (renders "Something went wrong" + error string), and calls `createRoot().render`.
   - Runtime load failures render "Failed to load app" + the error in `#root`.
4. `PreviewFrame` sets `iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms")` and assigns `iframe.srcdoc = previewHTML`. Every FS change re-assigns srcdoc, so the iframe **fully reloads** each time (no HMR, no state preservation).
5. Empty states: `firstLoad` skeleton wireframe; "Sem preview" with message otherwise.

Design-level observations:
- The preview is a **compile-in-the-browser** loop. The iframe is the only error surface; there is no parent-side error overlay (the error UI lives inside the iframe HTML).
- Per-file blob URLs plus import-map aliasing is a neat trick to resolve `@/` imports without a bundler. It works in Chromium-class browsers that support import maps (ASSUMED for other browsers).
- Security: `allow-scripts allow-same-origin` on a srcdoc iframe means the generated code runs with the parent's origin. Combined, those two flags let the frame remove its own sandbox attribute. This is a known weakness (ASSUMED from general browser-security knowledge, not tested). For a product that runs user-edited code, use a separate sandbox origin (e.g. a different host) or drop `allow-same-origin`.
- Runtime dependencies on the network: Tailwind Play CDN and esm.sh. The Play CDN is documented by Tailwind as for development only (ASSUMED from general knowledge). Fine for a preview, not for shipping.

### 3.2 Is it useful for previewing an EXPORTED landing page? (recommendation)

- **Yes, as a preview of React+Tailwind source** (the reference's exact use case). The pattern (Babel standalone → blob modules → import map → srcdoc) is small (~300 lines across two files) and has no build step. Keep the idea, rewrite the code.
- **Better for the new project:** if the canvas already produces **A2UI JSON** (declarative component tree), the preview should be an **A2UI renderer** (React components mapping catalog types to DOM) rendered directly in the page or in an iframe. No Babel, no CDN, no eval. The Babel path only matters if the AI produces JSX code. Keep the code path for "Export as React project", but do not run the AI's JSX in the main origin.
- **For exporting plain HTML landing pages:** a `srcdoc` of a static HTML string is simpler than the Babel pipeline; no import map needed.
- **For exported React projects:** ship a real bundle (Vite or similar) in the export zip. Use the reference's preview only as an "instant" preview, and say so in the UI.
- Things to copy: the entry-point detection heuristic, the error-as-HTML-in-iframe approach (keeps the parent app alive), the `ErrorBoundary` wrapper, the "every change re-renders the iframe" loop (simple and correct, though it resets state; for A2UI, re-render in place instead).

---

## 4. Persistence (Prisma/SQLite, anonymous projects, auth)

### 4.1 Schema (VERIFIED `prisma/schema.prisma`)

```prisma
generator client { provider = "prisma-client-js"  output = "../src/generated/prisma" }
datasource db { provider = "sqlite"  url = "file:./dev.db" }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String            // bcrypt hash
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  projects  Project[]
}

model Project {
  id        String   @id @default(cuid())
  name      String
  userId    String?           // optional: anonymous projects allowed in schema
  messages  String   @default("[]")   // JSON string of UIMessage[]
  data      String   @default("{}")   // JSON string of serialized virtual FS (path -> FileNode)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
Migrations: `20250619172131_init`, `20250619174023_optional_userid`, `20250619174322_remove_filesystem_add_data_to_project` (the last one merged a separate `FileSystem` table into `Project.data`, i.e. the project moved from relational files to one JSON blob). Generated client is committed under `src/generated/prisma` including a Windows query engine `.dll.node` (VERIFIED by listing) — a weak point (see §6).

### 4.2 Read/write paths (VERIFIED)

- `src/app/api/chat/route.ts` `onEnd`: if `projectId` is in the request and the cookie session is valid, `prisma.project.update({ where: {id, userId}, data: { messages: JSON.stringify(allMessages), data: JSON.stringify(fileSystem.serialize()) } })`. This happens **once per chat turn at stream end**, not per edit.
- Client sends the **entire file system** in every chat request body (`chat-context.tsx` `sendText`: `body: { files: fileSystem.serialize(), projectId }`) and the server rebuilds a `VirtualFileSystem` from it, then executes tools against that copy. The client also re-applies every tool call through `onToolCall` → `handleToolCall` (`file-system-context.tsx`). So each tool runs **twice** (server and client). Works, but it's a source of drift and is wasteful.
- Monaco edits (`CodeEditor.handleEditorChange` → `updateFile`) update only client state. **They are not persisted** until the next chat turn completes. A user who edits code and reloads loses the edit (VERIFIED by reading code paths; the project page reloads from DB).
- `src/actions/*` (server actions): `createProject` (requires session), `getProject`/`getProjects` (filter by `userId`), `signUp`, `signIn`, `signOut`, `getUser`. Auth enforced inside each action with `getSession()`.
- `src/app/page.tsx`: if logged in, redirects to most recent project or creates "New Design #NNNN". Anonymous users see `MainContent` with no project.
- `src/app/[projectId]/page.tsx`: requires user, loads project, otherwise redirects to `/`.

### 4.3 Anonymous projects (VERIFIED `src/lib/anon-work-tracker.ts`, `src/hooks/use-auth.ts`, `chat-context.tsx`)

- For anonymous sessions, `chat-context.tsx` writes `{messages, fileSystemData}` to **sessionStorage** (`uigen_anon_data`, flag `uigen_has_anon_work`) on each change.
- The only reader is `use-auth.ts` `handlePostSignIn`: after sign-in/sign-up it turns the anon work into a new project ("Design from HH:MM:SS") and navigates there, then clears the storage.
- Consequence: anonymous work survives a page reload within the same tab (sessionStorage) but is **not restored** on reload (no reader on load), and is lost when the tab closes. Sign-in is the only recovery path.

### 4.4 Auth (VERIFIED `src/lib/auth.ts`, `src/proxy.ts`)

- Custom JWT: `jose` `SignJWT` HS256, 7-day expiry, stored in `httpOnly`, `sameSite: lax`, `secure` in production, cookie `auth-token`.
- Secret: `process.env.JWT_SECRET || "development-secret-key"` — **a hardcoded fallback secret**. Must not be copied.
- Passwords: `bcrypt` cost 10; minimum length 8 enforced only in `signUp`.
- `src/proxy.ts` (Next 16 "proxy" file) tries to protect `/api/projects` and `/api/filesystem`, but **neither route exists** in the repo (VERIFIED by file listing). Real protection is per server action via `getSession()`. The API routes `/api/chat` and `/api/review` are **not** protected by the proxy and `/api/chat` only saves when a session exists, but it accepts any `files` payload from anyone (anonymous users can spend the server's API key). Rate limiting: none (only provider-side 429 retries).

### 4.5 Recommendation for the new project: start local-first

Proposed v1 (ASSUMED design, based on reference weaknesses):
- **Storage:** IndexedDB via a small wrapper (e.g. `idb-keyval` or Dexie; not verified in this study) holding `projects` documents: `{ id, schemaVersion, kind: "canvas" | "architecture" | "database", doc, createdAt, updatedAt, history? }`. localStorage only for UI prefs (panel sizes, last tab), with try/catch.
- **Portability:** Export/Import a single `*.vitrine.json` file (versioned, zod-validated on import). This also gives backup and sharing by email/drive without a backend.
- **Autosave:** debounced (e.g. 500 ms) writes on every canvas mutation; keep an undo stack in memory.
- **AI keys:** keep them server-side in env, never in the browser. Local models (Ollama / LM Studio) can be called from the browser directly if CORS allows, or through the same thin API route (ASSUMED; the reference has no local provider, see §6).
- **Auth/DB later:** only when sharing or multi-device is needed. Keep the same JSON document as the unit of sync so the migration is just "PUT the document".

Tradeoffs:

| Concern | Local-first (IndexedDB + JSON file) | Server (Prisma/SQLite + auth, as in reference) |
|---|---|---|
| Setup cost | Near zero: no DB, no auth, no migrations | Prisma generate, migrations, JWT secret, bcrypt, cookies |
| Works offline | Yes | No (except the editor shell) |
| Multi-device | Only via exported file | Yes |
| Sharing / collaboration | Export file or link to a static export | Needs auth + ACL |
| Backup | User-owned file | Operator-owned DB |
| AI key safety | Keys stay server-side anyway; needs a proxy route | Same |
| Quota | Browser storage quota (large but finite); Safari can evict non-installed site data (ASSUMED) | Server disk |
| Testing | Easy with fake-indexeddb (ASSUMED) | Needs DB fixtures |
| Schema evolution | You must version docs yourself (`schemaVersion` + migrate fn) | Prisma migrations |

Reference-specific lesson: the reference stores **whole FS blobs and whole message arrays** in a single text column. For the new product, store the canvas/graph/schema as a normalized but still single JSON document per project (simple to export), with IDs stable enough for review anchoring (§5).

---

## 5. Design Review: structure and reuse

### 5.1 How it works (VERIFIED `src/lib/review/schema.ts`, `review.ts`, `src/app/api/review/route.ts`, `review-context.tsx`, `ReviewPanel.tsx`)

Contract (zod 4):
```ts
ReviewRule = enum ["visual-hierarchy","spacing","color","interaction-states","depth","buttons",
                   "empty-loading-states","layout","accessibility","content"]
ReviewIssue = { id: string /* kebab slug */, title: string, file: string, severity: "low"|"medium"|"high",
                rule: ReviewRule, suggestion: string }
DesignReview = { score: number /*0..100*/, summary: string, issues: ReviewIssue[] }
```
Notes: the prompt asks for titles max 70 chars and at most 6 issues, but the zod schema does **not** enforce length or count (VERIFIED). Prompt is in Brazilian Portuguese for `summary/title/suggestion`.

Flow:
1. Client `ReviewProvider.run()` → `POST /api/review` with `{ files: fileSystem.serialize() }`.
2. Server: rejects empty input with 400 "Nada para revisar: gere um componente primeiro."; `getModelConfig()`; `runDesignReview(model, files)`:
```ts
const { output } = await generateText({
  model, instructions: reviewPrompt, prompt: filesToPrompt(files),   // every .jsx/.tsx file as "### FILE: path" fenced blocks
  maxRetries: 6,
  output: Output.object({ schema: DesignReview, name: "design_review", description: "..." }),
});
```
   Structured output via the AI SDK `Output.object` (schema validated; `NoObjectGeneratedError` → 502 "O modelo não devolveu um review válido").
3. Route returns `{ review, provider, modelId }`; route `maxDuration = 120`.
4. Client re-validates with `DesignReview.parse` ("o contrato vale nas duas pontas").
5. UI: side drawer with `ScoreRing` (animated 0→score), summary, issue count, `JSON` toggle (pretty-printed review), `issues` button copying `reviewToIssues(review)`.

`reviewToIssues` (VERIFIED) returns GitHub-issue drafts:
```ts
{ title: issue.title,
  body: "**Arquivo:** `file`\n**Regra:** `rule`\n**Severidade:** sev\n\n### Sugestão\n...\n\n---\nScore geral do review: N/100\n<!-- design-review-id: <issue.id> -->",
  labels: ["design-review", `severity:${severity}`] }
```
The HTML comment with the stable `id` is the dedupe key for the Aula-2 agent (`agent/review-to-issues.ts`, not read in detail). That's a good pattern: stable IDs + machine-readable footer.

Screen-level details worth copying: score bands (85/65 thresholds), staggered card entrance, severity + rule + file chips (rule as mono chip, file with icon at the right), suggestion text in muted color, "structured output · validado com zod" subtitle as a trust cue.

### 5.2 Reapplying the pattern

General shape to keep: `{ score, summary, issues[] }` where each issue has `id` (stable slug), `severity`, `rule` (closed enum), `title`, `suggestion` (actionable), and a **target** pointing at the thing to fix. Generalize `file` into `target: { kind, id, path? }`.

**(a) Landing surface (A2UI tree / canvas composition)**
- Target = the component node id (e.g. `hero.cta`), plus optional `path` in the A2UI tree.
- Rules: `visual-hierarchy`, `spacing`, `contrast`, `cta-clarity` (one primary CTA above the fold), `above-the-fold`, `mobile-layout`, `accessibility`, `content-realism` (no lorem ipsum, real prices), `interaction-states`.
- Deterministic pre-checks before the LLM (cheap and trustworthy): missing `alt` on images, heading order, empty buttons, contrast ratio computed from tokens, more than one primary button per section, text length limits. Feed the results into the same issue shape with `source: "rule"` vs `"ai"`.
- Suggestion can be a **patch**: JSON Pointer op, e.g. `{ "op": "replace", "path": "/surfaces/main/components/3/props/variant", "value": "primary" }`, so "Apply fix" is a one-click action, the way the reference's `str_replace` tool works.

**(b) Architecture graph (services, APIs, queues, DBs)**
- Target = node id and/or edge id(s) (`nodeIds: string[]`, `edgeIds: string[]`), because many architecture issues span edges.
- Rules (proposed): `single-point-of-failure`, `synchronous-chain-too-long`, `missing-queue-for-async`, `unbounded-fan-out`, `missing-auth-boundary`, `public-internal-mix`, `no-observability`, `shared-database-between-services`, `cycle`, `missing-cache-for-hot-read`.
- Score sub-dimensions (scalability, resilience, security, simplicity) so the score ring can show four small bars next to it.
- Scaffold link: each issue can offer "generate scaffold" for the affected node (the product's backend-scaffold feature).

**(c) DB schema (tables, columns, relations)**
- Target = `table` and optional `table.column` plus `relationId`.
- Rules (proposed): `missing-index-on-fk`, `missing-unique-constraint`, `nullable-fk-ambiguity`, `no-timestamps`, `naming-convention`, `pii-column-unprotected`, `cascade-delete-risk`, `denormalized-duplicate`, `missing-primary-key`, `enum-as-text`.
- Each issue can carry a migration snippet as the suggestion (SQL or Prisma), which the scaffold step can apply.
- Deterministic checks are strong here (FK without index is a graph query), so the LLM should only explain and prioritize.

Common reuse rule: keep the LLM call on `generateText` + `Output.object` with a zod schema; make the rule enum per product area; keep the deterministic checks as the first, cheap pass; always return stable ids so reviews can be diffed across runs and deduped when turned into issues.

---

## 6. Weak or awkward in the reference (do NOT copy)

1. **Double tool execution**: server runs tools on its own FS copy (`buildStrReplaceTool(fileSystem)`, `buildFileManagerTool`) and the client re-applies the same tool calls via `onToolCall`. Two sources of truth. For the new product: one document model, the server returns a patch/diff, the client applies it.
2. **Whole-state round trips**: every chat request posts the whole serialized FS and the server rebuilds it. Fine for small landing pages, bad for big graphs/schemas.
3. **Edits not persisted**: Monaco edits live only in client memory until the next AI turn (`onEnd` is the only save).
4. **Anonymous work**: sessionStorage + "restore only on sign-in" means a reload silently drops work; no visible "unsaved" state.
5. **Hardcoded JWT fallback secret** (`"development-secret-key"`) in `src/lib/auth.ts`.
6. **proxy.ts protects nonexistent routes** (`/api/projects`, `/api/filesystem`), giving false confidence. `/api/chat` and `/api/review` are unauthenticated and can use the operator's API key; no rate limit.
7. **Preview sandbox**: `allow-scripts allow-same-origin` on user-code iframe (see §3.1).
8. **Preview depends on CDNs at runtime** (`cdn.tailwindcss.com`, `esm.sh`) and a Play CDN config; fine for demos, bad for offline or exported output.
9. **Silent failures in preview**: missing local imports become blank placeholder components with no error; the user sees an empty section and no diagnostic.
10. **Full iframe reload on every FS change**: loses scroll and state; hurts perceived smoothness during streaming (the reference mitigates with the streaming timeline, but the preview still flashes).
11. **Hardcoded product copy and brand**: Portuguese strings inline in components (e.g. "Landing pages que vendem, em segundos.", "Nada para revisar: gere um componente primeiro.", "Revisando…"), no i18n layer. `layout.tsx` hardcodes `lang="pt-BR"` and `className="dark"`. Logo tagline "landing pages com IA · uigen" leaks the upstream project name.
12. **Dark mode is forced**: `class="dark"` on `<html>` and `app-bg dark` on the root; the light tokens are defined but unused. Acceptable for this brand, but make it a choice in the new project.
13. **Mixed styling systems**: shadcn tokens exist but most components use raw `zinc/violet/...` classes, so theming means editing many files.
14. **Provider registry hardcoded**: `PROVIDERS = ["anthropic","google","groq","openrouter"]` plus `mock`. **No OpenAI-compatible / local provider** (no Ollama, LM Studio, vLLM base-URL option). Adding one means editing `provider.ts` switch and `API_KEY_ENV`. For the new project, use a provider config object: `{ kind: "openai-compatible", baseURL, apiKey?, model }`.
15. **Provider-specific hacks in the route**: `forceFirstTool = isNewProject && provider !== "anthropic" && provider !== "mock"` and `stopWhen: isStepCount(provider === "mock" ? 4 : 40)`. Capability flags (tool-choice support, step limit) belong in provider config, not in `if` chains.
16. **Review prompt scoped to small-business landing pages** and rule enum baked to UI concerns; no schema-level limits (title length, issue count) despite the prompt asking for them.
17. **Review is not cached or diffable**: each click is a new paid call; no `id` stability check across runs beyond what the model returns.
18. **Generated code in the repo**: `src/generated/prisma` (including a Windows `.dll.node` engine) is committed. Keep generated artifacts out of git.
19. **Logic in React contexts**: `file-system-context.tsx` contains the tool-call interpreter (`handleToolCall`) — move domain logic into plain modules so it's testable without React.
20. **Unused/duplicate singletons**: `src/lib/file-system.ts` exports `fileSystem = new VirtualFileSystem()` alongside the per-request instances (ASSUMED unused; grep not run).
21. **Next.js-specific coupling**: `"use server"` actions and `server-only` for everything persistent; the design review and chat depend on the server route. A local-first app avoids most of this.
22. **Motion accessibility gap**: `prefers-reduced-motion` only disables the CSS animations, not the `motion/react` springs (VERIFIED by reading CSS and component code).

### Good to keep (short list)
- Agent timeline with pure step-mapping function and explicit states including "interrompido".
- Provider badge that shows `provider · model` and turns red on config error.
- Example-prompt chips on the empty state.
- Structured review with zod contract validated both sides, score ring, severity/rule/file chips, JSON view, and "copy as issues" with a stable id footer.
- Mock model implementing the provider interface so the whole UX (streaming, tools, review) runs offline and in CI (VERIFIED: `src/lib/mock-model.ts`). Keep this idea: the new product should have a deterministic "mock Reimaginar" for demos and tests.
- Visual identity (dark zinc base + violet/fuchsia/amber gradients + pill chips + window card).

---

## 7. Suggested next steps (for the new project)

1. Adopt the three-panel shell and window-card styling; replace hardcoded colors with the token set in §2.1 (keep the same values).
2. Build the agent timeline as a generic "run log" component fed by a pure mapper (`toRunStep(event)`) so it works for Reimaginar, backend scaffolds and DB scaffolds.
3. Make Design Review generic: `Review<TargetKind>` with `target` anchors, rule enums per area, deterministic pre-checks, and the same score/issue UI.
4. Persist locally (IndexedDB + versioned JSON export/import). Add the server only for AI calls.
5. Preview: A2UI renderer first; keep Babel/import-map only for the "export as React" path, and only in a sandbox origin.

## 8. Open questions

- Whether the new product wants the reference's Portuguese UX copy (the target user is Brazilian; ASSUMED yes, per the reference README and the product vision).
- Whether the new product keeps the forced dark theme.
- Exact local-model endpoints (Ollama `http://localhost:11434/v1`, LM Studio `http://localhost:1234/v1`) were NOT verified in this study; they are ASSUMED from general knowledge and should be checked on the live docs.
