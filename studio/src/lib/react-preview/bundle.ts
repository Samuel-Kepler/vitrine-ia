// Preview ao vivo do projeto React exportado (aba "React" do Studio).
// Mesma ideia do vitrine-ia (Babel no navegador + import map + iframe), com
// três diferenças: módulos como URLs data: (o iframe roda isolado, sem
// allow-same-origin), Tailwind v4 de navegador (a landing usa container
// queries) e navegação entre páginas avisando o Studio.
import { REACT_VERSIONS } from "@/lib/export/react";

type Babel = { transform: (code: string, opts: Record<string, unknown>) => { code?: string | null } };

export const TAILWIND_BROWSER = "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.5";
const ESM = "https://esm.sh";

const CODE_EXT = /\.(tsx?|jsx?)$/;

/**
 * Prefixo dos módulos locais no import map. Precisa ser um nome "nu": dentro de
 * um módulo data: um caminho "/src/…" não tem base para resolver e o import
 * map nem é consultado.
 */
export const APP = "@app";

/** Import map dos pacotes: React único para todos (lucide usa o mesmo). */
export function packageImports(): Record<string, string> {
  const v = REACT_VERSIONS;
  return {
    react: `${ESM}/react@${v.react}`,
    "react/jsx-runtime": `${ESM}/react@${v.react}/jsx-runtime`,
    "react-dom": `${ESM}/react-dom@${v["react-dom"]}?external=react`,
    "react-dom/client": `${ESM}/react-dom@${v["react-dom"]}/client?external=react`,
    "lucide-react": `${ESM}/lucide-react@${v["lucide-react"]}?external=react`,
  };
}

function normalize(parts: string[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return "/" + out.join("/");
}

/** Resolve um import relativo para o caminho absoluto de um arquivo existente. */
export function resolveImport(from: string, spec: string, files: Set<string>): string | null {
  if (!spec.startsWith(".") && !spec.startsWith("/")) return null;
  const base = spec.startsWith("/") ? spec : normalize([...from.split("/").slice(0, -1), ...spec.split("/")]);
  const tries = [base, ...[".tsx", ".ts", ".jsx", ".js"].map((e) => base + e), ...["/index.tsx", "/index.ts", "/index.jsx", "/index.js"].map((e) => base + e)];
  return tries.find((t) => files.has(t)) ?? null;
}

export interface Transformed {
  /** caminho -> código ES module já com imports absolutos. */
  modules: Map<string, string>;
  css: string;
  errors: { path: string; error: string }[];
}

/**
 * Transforma os arquivos do projeto (caminhos absolutos, ex.: /src/pages/Inicio.tsx).
 * TS/JSX -> JS; imports relativos -> absolutos; import de .css sai do código
 * (o CSS vai para o Tailwind de navegador); import.meta.env vira um objeto.
 */
export function transformProject(files: Record<string, string>, babel: Babel): Transformed {
  const names = new Set(Object.keys(files));
  const modules = new Map<string, string>();
  const errors: Transformed["errors"] = [];
  const css = Object.entries(files)
    .filter(([p]) => p.endsWith(".css"))
    .map(([p, c]) => `/* ${p} */\n${c.replace(/^@import\s+["']tailwindcss["'];?\s*$/m, "")}`)
    .join("\n");

  for (const [path, source] of Object.entries(files)) {
    if (!CODE_EXT.test(path) || path.endsWith(".d.ts") || /\/vite\.config\.[jt]s$/.test(path)) continue;
    try {
      const pre = source.replace(/import\.meta\.env/g, "(globalThis.__ENV__ || {})");
      const out =
        babel.transform(pre, {
          filename: path,
          presets: [["react", { runtime: "automatic" }], ...(/\.tsx?$/.test(path) ? [["typescript", { isTSX: path.endsWith("x"), allExtensions: true }]] : [])],
          sourceType: "module",
        }).code ?? "";
      const code = out
        .replace(/^\s*import\s+["'][^"']+\.css["'];?\s*$/gm, "")
        .replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"']+)\2/g, (m, pre: string, q: string, spec: string) => {
          if (spec.endsWith(".css")) return m;
          const abs = resolveImport(path, spec, names);
          if (abs) return `${pre}${q}${APP}${abs}${q}`;
          if (spec.startsWith(".")) throw new Error(`não achei o arquivo importado "${spec}"`);
          return m;
        });
      modules.set(path, code);
    } catch (e) {
      errors.push({ path, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { modules, css, errors };
}

const dataUrl = (code: string) => `data:text/javascript;charset=utf-8,${encodeURIComponent(code)}`;
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Script que roda dentro do iframe: links .html avisam o Studio; erros aparecem na tela. */
const BRIDGE = `
window.__ENV__ = {};
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  e.preventDefault();
  if (href && /\\.html$/.test(href)) parent.postMessage({ type: "vitrine-react-nav", file: href.split("/").pop() }, "*");
});
function showError(msg) {
  const el = document.getElementById("__err") || Object.assign(document.body.appendChild(document.createElement("pre")), { id: "__err" });
  el.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;margin:0;padding:12px 14px;background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:8px;font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;z-index:99999";
  el.textContent = msg;
  parent.postMessage({ type: "vitrine-react-error", message: msg }, "*");
}
window.addEventListener("error", (e) => showError(e.message || String(e.error)));
// Avisa o Studio quando a página montou (o iframe é isolado: o Studio não lê o DOM dele).
document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("root");
  const mo = new MutationObserver(() => {
    if (!root.childElementCount) return;
    mo.disconnect();
    const h1 = document.querySelector("h1");
    parent.postMessage({ type: "vitrine-react-ready", h1: h1 ? h1.textContent : "", links: [...document.querySelectorAll("header nav a")].map((a) => a.getAttribute("href")) }, "*");
  });
  mo.observe(root, { childList: true, subtree: true });
});
window.addEventListener("unhandledrejection", (e) => showError(String(e.reason && e.reason.message || e.reason)));
`;

/** HTML do iframe para uma entrada (ex.: /src/entries/index.tsx). */
export function previewHtml(t: Transformed, entry: string, title = "Preview"): string {
  const imports: Record<string, string> = { ...packageImports() };
  for (const [path, code] of t.modules) imports[APP + path] = dataUrl(code);
  const errors = t.errors.map((e) => `${e.path}: ${e.error}`).join("\n\n");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<script src="${TAILWIND_BROWSER}"></script>
<style type="text/tailwindcss">
${t.css.replace(/<\/style/gi, "<\\/style")}
</style>
<script type="importmap">${JSON.stringify({ imports }).replace(/<\/script/gi, "<\\/script")}</script>
<script>${BRIDGE}</script>
</head>
<body style="margin:0">
<div id="root"></div>
${errors ? `<script>showError(${JSON.stringify("Erro de sintaxe:\n" + errors)});</script>` : `<script type="module">import ${JSON.stringify(APP + entry)};</script>`}
</body>
</html>`;
}
