import { describe, expect, it } from "vitest";
import { starterDraft } from "./starter";
import { createNode } from "./tree";
import { linkPagesInHtml, pageFile, siteDraft, type Page } from "./pages";
import { projectFiles } from "@/lib/export/project";
import { sitePalette } from "@/components/studio/reimagine-client";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";

function site(): Page[] {
  const home = starterDraft();
  const contact = [home[0], createNode("form"), home[home.length - 1]];
  return [
    { id: "a", name: "Início", slug: "inicio", tree: home, result: null },
    { id: "b", name: "Cardápio", slug: "cardapio", tree: [home[0], createNode("section"), home[home.length - 1]], result: null },
    { id: "c", name: "Contato", slug: "contato", tree: contact, result: null },
  ];
}

describe("site com várias páginas", () => {
  it("primeira página é index.html, as outras usam o slug", () => {
    const pages = site();
    expect(pages.map((p) => pageFile(pages, p.id))).toEqual(["index.html", "cardapio.html", "contato.html"]);
  });

  it("liga os links do menu aos arquivos e deixa os outros como estão", () => {
    const html = '<nav><a href="#" class="x">Cardápio</a><a href="#">Sobre</a><a class="y" href="#"><span>Contato</span></a><a href="#">Início</a></nav>';
    const out = linkPagesInHtml(html, site());
    expect(out).toContain('<a href="cardapio.html" class="x">Cardápio</a>');
    expect(out).toContain('<a href="#">Sobre</a>');
    expect(out).toContain('<a class="y" href="contato.html"><span>Contato</span></a>');
    expect(out).toContain('<a href="index.html">Início</a>');
  });

  it("Sugerir lê o site inteiro: um menu, o miolo de todas as páginas e um rodapé", () => {
    const d = siteDraft(site());
    expect(d.filter((n) => n.type === "navbar")).toHaveLength(1);
    expect(d.filter((n) => n.type === "footer")).toHaveLength(1);
    expect(d[0].type).toBe("navbar");
    expect(d[d.length - 1].type).toBe("footer");
    // o formulário da página Contato entra (vira rota/tabela no Sugerir)
    expect(d.filter((n) => n.type === "form").length).toBeGreaterThanOrEqual(2);
  });

  it("a paleta do site vem da primeira página já reimaginada", () => {
    const r = (palette: string) => ({ express: `root = Page(child=x, palette="${palette}")` }) as unknown as ReimagineResult;
    expect(sitePalette([{ result: null }, { result: r("forest") }, { result: r("grape") }])).toBe("forest");
    expect(sitePalette([{ result: null }])).toBeUndefined();
  });

  it("zip: um HTML por página e o README lista as páginas automáticas", () => {
    const files = projectFiles({
      webPages: [
        { file: "index.html", name: "Início", html: "<h1>a</h1>" },
        { file: "cardapio.html", name: "Cardápio", html: "<h1>b</h1>", auto: true },
      ],
      arch: { nodes: [], edges: [] },
      db: { tables: [], relations: [] },
    });
    expect(files.map((f) => f.path)).toEqual(["README.md", "web/index.html", "web/cardapio.html"]);
    expect(files[0].content).toContain("2 páginas");
    expect(files[0].content).toMatch(/web\/cardapio.html`: Cardápio \(versão automática/);
  });
});
