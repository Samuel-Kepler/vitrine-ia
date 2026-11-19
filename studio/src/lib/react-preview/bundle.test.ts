import { describe, expect, it } from "vitest";
import * as Babel from "@babel/standalone";
import { starterDraft } from "@/lib/draft/starter";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { reactProject } from "@/lib/export/react";
import { packageImports, previewHtml, resolveImport, transformProject } from "./bundle";

function files() {
  const pages = [
    { name: "Início", file: "index.html", messages: compileResponse(draftToExpress(starterDraft())).messages },
    { name: "Contato", file: "contato.html", messages: compileResponse(draftToExpress(starterDraft().slice(-2))).messages },
  ];
  return Object.fromEntries(reactProject(pages).map((f) => [f.path.replace(/^react/, ""), f.content]));
}

describe("resolveImport", () => {
  const set = new Set(["/src/components/landing.tsx", "/src/pages/Inicio.tsx", "/src/lib/index.ts"]);
  it("relativo com e sem extensão, index e pacotes", () => {
    expect(resolveImport("/src/pages/Inicio.tsx", "../components/landing", set)).toBe("/src/components/landing.tsx");
    expect(resolveImport("/src/entries/index.tsx", "../pages/Inicio", set)).toBe("/src/pages/Inicio.tsx");
    expect(resolveImport("/src/pages/Inicio.tsx", "../lib", set)).toBe("/src/lib/index.ts");
    expect(resolveImport("/src/pages/Inicio.tsx", "react", set)).toBeNull();
  });
});

describe("transformProject", () => {
  it("compila TSX, troca imports relativos por absolutos e tira o import de css", () => {
    const t = transformProject(files(), Babel);
    expect(t.errors).toEqual([]);
    const entry = t.modules.get("/src/entries/index.tsx")!;
    expect(entry).toContain('from "@app/src/pages/Inicio.tsx"');
    expect(entry).not.toMatch(/index\.css/);
    expect(entry).toMatch(/from "react\/jsx-runtime"/);
    const page = t.modules.get("/src/pages/Inicio.tsx")!;
    expect(page).toContain('from "@app/src/components/landing.tsx"');
    expect(page).toContain("(globalThis.__ENV__ || {})");
    expect(t.modules.has("/vite.config.ts")).toBe(false);
    expect(t.css).toContain(".lp-btn");
    expect(t.css).not.toMatch(/@import "tailwindcss"/);
  });

  it("erro de sintaxe vira mensagem com o arquivo, sem derrubar o resto", () => {
    const f = { ...files(), "/src/pages/Contato.tsx": "export default function X() { return <div> }" };
    const t = transformProject(f, Babel);
    expect(t.errors.map((e) => e.path)).toEqual(["/src/pages/Contato.tsx"]);
    expect(previewHtml(t, "/src/entries/contato.tsx")).toContain("Erro de sintaxe");
  });
});

describe("previewHtml", () => {
  it("import map com React único, módulos data:, Tailwind v4 e a entrada", () => {
    const t = transformProject(files(), Babel);
    const html = previewHtml(t, "/src/entries/index.tsx", "Início");
    const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1]).imports;
    expect(map["lucide-react"]).toContain("?external=react");
    expect(map.react).toBe(packageImports().react);
    expect(map["@app/src/components/landing.tsx"]).toMatch(/^data:text\/javascript/);
    expect(html).toContain("@tailwindcss/browser@4.3.5");
    expect(html).toContain('<script type="module">import "@app/src/entries/index.tsx";</script>');
    expect(html).toContain("vitrine-react-nav");
  });
});

describe("store: arquivos React", () => {
  it("gerar zera o 'editado'; editar um arquivo marca", async () => {
    const { useStudio } = await import("@/lib/draft/store");
    useStudio.getState().setReactFiles({ "/a.tsx": "x" });
    expect(useStudio.getState().reactEdited).toBe(false);
    useStudio.getState().setReactFile("/a.tsx", "y");
    expect(useStudio.getState()).toMatchObject({ reactEdited: true, reactFiles: { "/a.tsx": "y" } });
    useStudio.getState().setReactFiles(null);
    expect(useStudio.getState().reactEdited).toBe(false);
  });
});
