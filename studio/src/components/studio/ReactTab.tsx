"use client";
// Aba "React": o site como projeto React (o mesmo do Exportar), com editor
// (Monaco, como no vitrine-ia) e preview ao vivo num iframe isolado.
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, Download, FileCode2, Loader2, RefreshCw } from "lucide-react";
import { ReactChat } from "./ReactChat";
import { useStudio } from "@/lib/draft/store";
import { reactProject } from "@/lib/export/react";
import { previewHtml, transformProject } from "@/lib/react-preview/bundle";
import { collectSitePages, siteBrand } from "./site-pages";
import { downloadZip } from "./export";
import { useResolvedTheme } from "./useTheme";
import { exportAssetFiles, resolveAssets } from "@/lib/assets/assets";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false, loading: () => <p className="p-4 text-xs text-muted">Carregando editor…</p> });

const LANG: Record<string, string> = { tsx: "typescript", ts: "typescript", css: "css", html: "html", json: "json", md: "markdown" };
const langOf = (p: string) => LANG[p.split(".").pop() ?? ""] ?? "plaintext";

/** Ordem da lista: páginas e componentes primeiro, configuração por último. */
function sortFiles(paths: string[]): string[] {
  const rank = (p: string) => (p.startsWith("/src/pages/") ? 0 : p.startsWith("/src/components/") ? 1 : p.startsWith("/src/") ? 2 : p.endsWith(".html") ? 3 : 4);
  return [...paths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

async function generate(): Promise<Record<string, string>> {
  const pages = await collectSitePages();
  return Object.fromEntries(reactProject(pages, { brand: siteBrand() }).map((f) => [f.path.replace(/^react/, ""), f.content]));
}

export default function ReactTab() {
  const files = useStudio((s) => s.reactFiles);
  const edited = useStudio((s) => s.reactEdited);
  const setReactFiles = useStudio((s) => s.setReactFiles);
  const setReactFile = useStudio((s) => s.setReactFile);
  const [active, setActive] = useState<string | null>(null);
  const [entry, setEntry] = useState("index");
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [ready, setReady] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const monacoTheme = useResolvedTheme() === "dark" ? "vs-dark" : "vs";

  const regenerate = useCallback(async () => {
    setBusy(true);
    setError(null);
    setConfirmRegen(false);
    try {
      setReactFiles(await generate());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [setReactFiles]);

  // Primeira visita: gera o projeto a partir das páginas do Studio.
  useEffect(() => {
    if (!files && !busy) void regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paths = useMemo(() => sortFiles(Object.keys(files ?? {})), [files]);
  const entries = useMemo(
    () =>
      paths
        .filter((p) => /^\/[^/]+\.html$/.test(p))
        .map((p) => ({ key: p.slice(1, -5), title: files?.[p]?.match(/<title>([^<]*)<\/title>/)?.[1]?.split(" · ")[0] ?? p.slice(1) })),
    [paths, files],
  );
  const current = active && files?.[active] !== undefined ? active : paths[0];

  // Preview: recompila 400ms depois da última edição.
  useEffect(() => {
    if (!files) return;
    let alive = true;
    const t = setTimeout(async () => {
      const babel = await import("@babel/standalone");
      if (!alive) return;
      const key = entries.some((e) => e.key === entry) ? entry : (entries[0]?.key ?? "index");
      setRuntimeError(null);
      setReady(null);
      // Imagens do computador: no preview entram embutidas (o iframe isolado não tem /public).
      setHtml(previewHtml(transformProject(resolveAssets(files, useStudio.getState().assets), babel), `/src/entries/${key}.tsx`, key));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [files, entry, entries]);

  // Mensagens do iframe: navegação entre páginas e erros de execução.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== iframe.current?.contentWindow) return;
      const d = e.data as { type?: string; file?: string; message?: string };
      if (d?.type === "vitrine-react-nav" && d.file) setEntry(d.file.replace(/\.html$/, ""));
      if (d?.type === "vitrine-react-error") setRuntimeError(d.message ?? "Erro");
      if (d?.type === "vitrine-react-ready") setReady(JSON.stringify(d));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  if (!files) {
    return (
      <div className="flex flex-1 items-center justify-center bg-canvas p-6 text-sm text-muted">
        {error ? (
          <p className="rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-red-800 dark:text-red-200">
            Não deu para gerar o projeto: {error}{" "}
            <button className="underline" onClick={regenerate}>
              tentar de novo
            </button>
          </p>
        ) : (
          <p className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Gerando o projeto React…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="react-tab">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2 text-xs">
        <span className="label-mono">Vite + React + Tailwind</span>
        {edited ? <span className="rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 font-medium text-amber-800 dark:text-amber-200">editado à mão</span> : <span className="text-muted">gerado do A2UI, sem IA</span>}
        <div className="ml-auto flex items-center gap-2">
          {confirmRegen ? (
            <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-100">
              Regerar apaga suas edições.
              <button className="rounded bg-amber-600 px-2 py-1 text-white" onClick={regenerate} data-testid="react-regen-confirm">
                regerar
              </button>
              <button className="rounded px-2 py-1 hover:bg-line" onClick={() => setConfirmRegen(false)}>
                cancelar
              </button>
            </span>
          ) : (
            <button
              onClick={() => (edited ? setConfirmRegen(true) : regenerate())}
              disabled={busy}
              title="Gera de novo a partir das páginas do Studio (use depois de Reimaginar)"
              data-testid="react-regen"
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 hover:bg-canvas disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regerar do Studio
            </button>
          )}
          <button
            onClick={() => setChatOpen((v) => !v)}
            aria-pressed={chatOpen}
            data-testid="react-chat-toggle"
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${chatOpen ? "border-brand bg-brand-soft text-brand" : "border-line hover:bg-canvas"}`}
          >
            <Bot size={14} /> Chat IA
          </button>
          <button
            onClick={() =>
              downloadZip("vitrine-react.zip", exportAssetFiles(Object.entries(files).map(([path, content]) => ({ path: path.slice(1), content })), useStudio.getState().assets))
            }
            className="flex items-center gap-1.5 rounded-md bg-ink px-2.5 py-1.5 text-on-solid hover:opacity-90"
            data-testid="react-download"
          >
            <Download size={14} /> Baixar projeto React
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ul className="w-56 shrink-0 overflow-y-auto border-r border-line bg-panel py-2 text-xs" aria-label="Arquivos">
          {paths.map((p) => (
            <li key={p}>
              <button
                onClick={() => setActive(p)}
                className={`flex w-full items-center gap-1.5 truncate px-3 py-1.5 text-left font-mono ${p === current ? "bg-brand-soft text-brand" : "text-ink hover:bg-canvas"}`}
                title={p}
              >
                <FileCode2 size={13} className="shrink-0" />
                <span className="truncate">{p.slice(1)}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="min-w-0 flex-1 border-r border-line bg-panel">
          {current ? (
            <Editor
              key={current}
              theme={monacoTheme}
              path={current}
              defaultLanguage={langOf(current)}
              language={langOf(current)}
              value={files[current]}
              onChange={(v) => v !== undefined && v !== files[current] && setReactFile(current, v)}
              beforeMount={(monaco) => {
                // Sem checagem de tipos/imports (o editor não conhece os pacotes); só sintaxe e JSX.
                const ts = monaco.languages.typescript;
                ts.typescriptDefaults.setCompilerOptions({ jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, allowNonTsExtensions: true, module: ts.ModuleKind.ESNext });
                ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
              }}
              options={{ fontSize: 13, minimap: { enabled: false }, scrollBeyondLastLine: false, wordWrap: "on", tabSize: 2, fontFamily: "var(--font-jetbrains), ui-monospace, monospace" }}
            />
          ) : null}
        </div>

        <div className={`flex ${chatOpen ? "w-[36%]" : "w-[44%]"} min-w-[300px] flex-col bg-canvas`}>
          <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-1.5 text-xs">
            <span className="label-mono">Preview</span>
            <select value={entry} onChange={(e) => setEntry(e.target.value)} className="rounded-md border border-line bg-panel px-1.5 py-1" aria-label="Página do preview" data-testid="react-entry">
              {entries.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.title} ({e.key}.html)
                </option>
              ))}
            </select>
            {runtimeError ? (
              <span className="flex min-w-0 items-center gap-1 text-red-700 dark:text-red-300" title={runtimeError}>
                <AlertTriangle size={13} className="shrink-0" /> <span className="truncate">erro no preview</span>
              </span>
            ) : null}
          </div>
          {html ? (
            <iframe
              ref={iframe}
              title="Preview do projeto React"
              srcDoc={html}
              // Isolado: scripts sim, mesma origem do Studio não.
              sandbox="allow-scripts allow-forms"
              className="min-h-0 flex-1 bg-white"
              data-testid="react-preview"
              data-ready={ready ?? undefined}
            />
          ) : (
            <p className="p-4 text-xs text-muted">Compilando…</p>
          )}
        </div>
        {chatOpen ? <ReactChat onClose={() => setChatOpen(false)} onOpenFile={setActive} /> : null}
      </div>
    </div>
  );
}
