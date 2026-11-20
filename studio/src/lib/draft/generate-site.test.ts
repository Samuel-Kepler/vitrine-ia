import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { GeneratedSiteSchema, templateSite, toSite, type GeneratedSite } from "./generate-shared";
import { chromeOf, HOME_ID } from "./pages";
import { useStudio } from "./store";

function assertStrict(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.type === "object" && o.properties) expect([...((o.required as string[]) ?? [])].sort(), `${path}.required`).toEqual(Object.keys(o.properties as object).sort());
  for (const [k, v] of Object.entries(o)) assertStrict(v, `${path}.${k}`);
}
const kv = (o: Record<string, string>) => Object.entries(o).map(([key, value]) => ({ key, value }));

const AI: GeneratedSite = {
  navbar: { props: kv({ brand: "Studio Leve", cta: "Agendar aula", links: "ignorado" }) },
  footer: { props: kv({ text: "© 2026 Studio Leve" }) },
  pages: [
    { name: "Início", blocks: [{ type: "hero", props: kv({ title: "Pilates para todo dia" }), children: [] }, { type: "navbar", props: [], children: [] }] },
    { name: "Planos", blocks: [{ type: "section", props: [], children: [{ type: "heading", props: kv({ text: "Planos" }) }, { type: "pricing", props: kv({ name: "[plano 1]", price: "[preço]" }) }] }] },
    { name: "planos", blocks: [{ type: "hero", props: kv({ title: "duplicada" }), children: [] }] },
    { name: "Contato", blocks: [{ type: "form", props: kv({ title: "Fale com a gente", fields: "Nome\nE-mail" }), children: [] }] },
  ],
  notes: ["Preencha os preços."],
};

describe("GeneratedSiteSchema", () => {
  it("é compatível com saída estruturada estrita", () => assertStrict(z.toJSONSchema(GeneratedSiteSchema)));
});

describe("toSite", () => {
  it("menu e rodapé compartilhados, links = nomes das páginas, sem página repetida nem menu no miolo", () => {
    const site = toSite(AI);
    expect(site.pages.map((p) => p.name)).toEqual(["Início", "Planos", "Contato"]);
    const navs = site.pages.map((p) => chromeOf(p.tree).navbar);
    expect(new Set(navs).size).toBe(1);
    expect(navs[0]!.props).toMatchObject({ brand: "Studio Leve", cta: "Agendar aula", links: "Início\nPlanos\nContato" });
    for (const p of site.pages) {
      expect(p.tree[0].type).toBe("navbar");
      expect(p.tree[p.tree.length - 1].type).toBe("footer");
      expect(p.tree.filter((n) => n.type === "navbar")).toHaveLength(1);
    }
    expect(site.pages[2].tree[1].props.fields).toBe("Nome\nE-mail");
  });
});

describe("templateSite (sem IA)", () => {
  it("Início + uma página por assunto + Contato, sem fatos inventados", () => {
    const site = templateSite("estúdio de pilates com planos, galeria de fotos, sobre nós e agendamento");
    expect(site.pages.map((p) => p.name)).toEqual(["Início", "Sobre", "Galeria", "Planos", "Contato"]);
    const contato = site.pages[site.pages.length - 1].tree.find((n) => n.type === "form")!;
    expect(contato.props.title).toBe("Faça sua reserva");
    const text = JSON.stringify(site, (k, v) => (k === "id" ? undefined : v));
    expect(text).not.toMatch(/R\$ ?\d|\d+h\b|Cliente feliz/);
  });
  it("pedido vago: ainda gera Início e Contato", () => {
    expect(templateSite("loja legal").pages.map((p) => p.name)).toEqual(["Início", "Contato"]);
  });
});

describe("store.replaceSite", () => {
  it("troca todas as páginas e abre a primeira", () => {
    const site = templateSite("café com cardápio e sobre");
    useStudio.getState().replaceSite(site.pages);
    const s = useStudio.getState();
    expect(s.pages.map((p) => p.name)).toEqual(["Início", "Cardápio", "Sobre", "Contato"]);
    expect(s.pageId).toBe(HOME_ID);
    expect(s.tree).toBe(site.pages[0].tree);
    expect(s.pages.map((p) => p.slug)).toEqual(["inicio", "cardapio", "sobre", "contato"]);
  });
});

describe("POST /api/generate scope=site", () => {
  it("mock usa o modelo automático do site", async () => {
    const { POST } = await import("@/app/api/generate/route");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ prompt: "barbearia com planos e contato", scope: "site", settings: { kind: "mock" } }) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("mock");
    expect(json.site.pages.map((p: { name: string }) => p.name)).toEqual(["Início", "Planos", "Contato"]);
  });
});
