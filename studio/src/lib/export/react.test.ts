import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { starterDraft } from "@/lib/draft/starter";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { templateSite } from "@/lib/draft/generate-shared";
import { LANDING_COMPONENTS_TSX, LANDING_CSS } from "./react-sources";
import { pageToTsx, reactProject, type ReactPage } from "./react";

const lf = (p: string) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const msgs = (tree: Parameters<typeof draftToExpress>[0]) => compileResponse(draftToExpress(tree, { palette: "forest" })).messages;

function sitePages(): ReactPage[] {
  const site = templateSite("pilates com planos, galeria e contato");
  return site.pages.map((p, i) => ({ name: p.name, file: i === 0 ? "index.html" : `${p.name.toLowerCase()}.html`, messages: msgs(p.tree) }));
}

describe("react-sources", () => {
  it("cópia embutida está igual aos arquivos (rode npm run gen:sources se falhar)", () => {
    expect(LANDING_COMPONENTS_TSX).toBe(lf("src/lib/a2ui/landing-components.tsx"));
    expect(LANDING_CSS).toBe(lf("src/lib/a2ui/landing.css"));
  });
});

describe("pageToTsx", () => {
  it("traduz a página inicial: menu com links das páginas, seções, formulário que envia", () => {
    const href = (l: string) => (l === "Contato" ? "contato.html" : "#");
    const { code, component } = pageToTsx({ name: "Início", file: "index.html", messages: msgs(starterDraft()) }, href);
    expect(component).toBe("Inicio");
    expect(code).toMatch(/^import \{ [A-Za-z, ]+ \} from "\.\.\/components\/landing";/m);
    expect(code).toContain('<Page palette={"forest"}>');
    expect(code).toContain('hrefs={["#","#","contato.html"]}');
    expect(code).toContain("<FormCard endpoint={LEADS_URL}>");
    expect(code).toMatch(/<Button variant=\{"primary"\} type=\{"submit"\}>\{"quero receber"\}<\/Button>/);
    expect(code).toMatch(/<TextField label=\{"E-mail"\} name=\{"e_mail"\} \/>/);
    expect(code).not.toMatch(/não exportado|não encontrado/);
    // textos vão como JSON: aspas e chaves não quebram o JSX
    const tricky = pageToTsx({ name: "x", file: "x.html", messages: msgs([{ id: "h", type: "hero", props: { title: 'Pão "quente" {já}', subtitle: "", cta: "" } }]) }, () => "#");
    expect(tricky.code).toContain('title={"Pão \\"quente\\" {já}"}');
  });
});

describe("reactProject", () => {
  it("um HTML + página + entrada por página, componentes, css e config do Vite", () => {
    const files = reactProject(sitePages(), { brand: "Studio" });
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "react/index.html",
        "react/contato.html",
        "react/src/pages/Inicio.tsx",
        "react/src/pages/Contato.tsx",
        "react/src/entries/index.tsx",
        "react/src/entries/contato.tsx",
        "react/src/components/landing.tsx",
        "react/src/index.css",
        "react/vite.config.ts",
        "react/package.json",
        "react/README.md",
      ]),
    );
    const vite = files.find((f) => f.path === "react/vite.config.ts")!.content;
    expect(vite).toContain('"contato": fileURLToPath(new URL("./contato.html", import.meta.url))');
    const pkg = JSON.parse(files.find((f) => f.path === "react/package.json")!.content);
    expect(pkg.devDependencies.vite).toBe("7.3.7");
    expect(Object.values({ ...pkg.dependencies, ...pkg.devDependencies }).every((v) => /^\d+\.\d+\.\d+$/.test(String(v)))).toBe(true);
    expect(files.find((f) => f.path === "react/src/index.css")!.content).toMatch(/^@import "tailwindcss";[\s\S]*\.lp-btn/);
    expect(files.find((f) => f.path === "react/index.html")!.content).toContain("<title>Início · Studio</title>");
  });

  // Para testar o build de verdade: REACT_OUT=examples/react-site npx vitest run src/lib/export/react.test.ts
  it.skipIf(!process.env.REACT_OUT)("grava o projeto em REACT_OUT", () => {
    for (const f of reactProject(sitePages(), { brand: "Studio" })) {
      const p = join(process.env.REACT_OUT!, f.path.replace(/^react\//, ""));
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
  });
});
