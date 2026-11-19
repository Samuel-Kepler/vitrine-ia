// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { DraftNode } from "@/lib/draft/tree";
import { compileResponse } from "@/lib/a2ui/agent";
import { draftToExpress } from "@/lib/draft/to-express";
import { extractOutline, outlinesToSite, outlineToDraft, outlineToPrompt, pageNameFromFile, PageOutlineSchema } from "./outline";

const HOME = `<!doctype html><html><head><title>Café Aurora | Cafeteria no centro</title><script>alert("não roda")</script></head>
<body>
  <header><a href="/" class="logo">Café Aurora</a><nav><a href="index.html">Início</a><a href="cardapio.html">Cardápio</a><a href="contato.html">Contato</a></nav></header>
  <main>
    <section class="hero">
      <h1>Café especial no coração da cidade</h1>
      <p>Grãos torrados na casa, todos os dias.</p>
      <a class="btn btn-primary" href="#reserva">Reservar mesa</a>
      <img src="https://images.exemplo.com/fachada.jpg" alt="Fachada do café">
      <img src="img/local.jpg" alt="relativa">
    </section>
    <section>
      <h2>Por que a Aurora</h2>
      <ul><li>Grãos de origem única</li><li>Pão de fermentação natural</li></ul>
      <p>Aberto desde <a href="/historia">2015</a>.</p>
    </section>
    <section id="reserva">
      <h2>Reserve sua mesa</h2>
      <form><label for="n">Seu nome</label><input id="n"><input type="email" placeholder="E-mail"><input type="hidden" name="x"><button type="submit">Enviar reserva</button></form>
    </section>
  </main>
  <footer><p>© 2026 Café Aurora · Rua das Flores, 10</p><a href="https://instagram.com/x">Instagram</a></footer>
</body></html>`;

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("extractOutline", () => {
  const o = extractOutline(parse(HOME), "index.html");

  it("lê título, marca, menu e rodapé", () => {
    expect(o.title).toBe("Café Aurora | Cafeteria no centro");
    expect(o.brand).toBe("Café Aurora");
    expect(o.nav).toEqual(["Início", "Cardápio", "Contato"]);
    expect(o.footer.text).toContain("Rua das Flores");
    expect(o.footer.links).toEqual(["Instagram"]);
    expect(PageOutlineSchema.safeParse(o).success).toBe(true);
  });

  it("guarda conteúdo na ordem, sem scripts, menu ou imagens relativas", () => {
    const kinds = o.items.map((i) => `${i.kind}:${i.text}`);
    expect(kinds.slice(0, 4)).toEqual(["h1:Café especial no coração da cidade", "p:Grãos torrados na casa, todos os dias.", "button:Reservar mesa", "img:Fachada do café"]);
    expect(kinds).toContain("li:Grãos de origem única");
    expect(kinds).toContain("p:Aberto desde 2015.");
    expect(kinds).toContain("field:Seu nome");
    expect(kinds).toContain("field:E-mail");
    expect(kinds).toContain("button:Enviar reserva");
    expect(JSON.stringify(o)).not.toMatch(/alert|img\/local\.jpg|"x"/);
    expect(o.items.filter((i) => i.text === "Cardápio")).toEqual([]);
  });

  it("nome da página vem do arquivo", () => {
    expect(pageNameFromFile("index.html", "x")).toBe("Início");
    expect(pageNameFromFile("pasta/sobre-nos.html", "x")).toBe("Sobre nos");
  });
});

const find = (tree: DraftNode[], type: string): DraftNode[] =>
  tree.flatMap((n) => [...(n.type === type ? [n] : []), ...find(n.children ?? [], type)]);

describe("outlineToDraft (sem IA)", () => {
  const tree = outlineToDraft(extractOutline(parse(HOME), "index.html"), { year: 2026 });

  it("monta navbar, hero, seções por h2, form e footer com os textos originais", () => {
    expect(tree.map((n) => n.type)).toEqual(["navbar", "hero", "section", "form", "footer"]);
    const [nav, hero] = tree;
    expect(nav.props).toMatchObject({ brand: "Café Aurora", links: "Início\nCardápio\nContato" });
    expect(hero.props).toMatchObject({
      title: "Café especial no coração da cidade",
      subtitle: "Grãos torrados na casa, todos os dias.",
      cta: "Reservar mesa",
      image: "https://images.exemplo.com/fachada.jpg",
    });
    expect(find(tree, "heading").map((h) => h.props.text)).toEqual(["Por que a Aurora"]);
    expect(find(tree, "text").map((t) => t.props.text)).toContain("• Grãos de origem única\n• Pão de fermentação natural");
    // Seção que só tinha o título do formulário vira o título do form.
    expect(tree[3].props).toMatchObject({ title: "Reserve sua mesa", fields: "Seu nome\nE-mail", cta: "Enviar reserva" });
  });

  it("não inventa: campos sem conteúdo ficam vazios", () => {
    const all = (ns: DraftNode[]): string[] => ns.flatMap((n) => [...Object.values(n.props), ...all(n.children ?? [])]);
    const texts = all(tree).join("\n");
    expect(texts).not.toMatch(/R\$|Cliente feliz|\[[^\]]*\]/);
    expect(texts).toContain("Grãos torrados na casa");
  });

  it("o rascunho importado compila para A2UI válido (pronto para o Reimaginar)", () => {
    expect(() => compileResponse(draftToExpress(tree))).not.toThrow();
  });

  it("site com várias páginas: menu lista as páginas importadas", () => {
    const menu = extractOutline(parse("<title>Cardápio</title><main><h1>Cardápio</h1><p>Espresso</p></main>"), "cardapio.html");
    const site = outlinesToSite([extractOutline(parse(HOME), "index.html"), menu]);
    expect(site.map((p) => p.name)).toEqual(["Início", "Cardapio"]);
    expect(site[1].tree[0].props.links).toBe("Início\nCardapio");
  });
});

describe("outlineToPrompt", () => {
  it("vira texto compacto e respeita o limite", () => {
    const o = extractOutline(parse(HOME), "index.html");
    const p = outlineToPrompt(o);
    expect(p).toContain("H1: Café especial no coração da cidade");
    expect(p).toContain("IMG: https://images.exemplo.com/fachada.jpg (Fachada do café)");
    expect(outlineToPrompt(o, 100).length).toBeLessThan(140);
  });
});
