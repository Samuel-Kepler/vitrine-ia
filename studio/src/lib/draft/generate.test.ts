import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { starterDraft } from "./starter";
import { chromeOf } from "./pages";
import { GeneratedPageSchema, mergeGenerated, templateFromPrompt, toDraft, type GeneratedPage } from "./generate-shared";
import { draftToExpress } from "./to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { generateSource } from "@/components/studio/GeneratePanel";

function assertStrict(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.type === "object" && o.properties) expect([...((o.required as string[]) ?? [])].sort(), `${path}.required`).toEqual(Object.keys(o.properties as object).sort());
  for (const [k, v] of Object.entries(o)) assertStrict(v, `${path}.${k}`);
}

const kv = (o: Record<string, string>) => Object.entries(o).map(([key, value]) => ({ key, value }));

const AI: GeneratedPage = {
  blocks: [
    { type: "hero", props: kv({ title: "Pão quentinho", subtitle: "Fornada às [horário]", bogus: "x", image: "url-da-imagem-hero.jpg" }), children: [] },
    { type: "navbar", props: kv({ brand: "Padaria Sol", links: "Pães\nEncomendas" }), children: [] },
    { type: "section", props: kv({ tone: "neon" }), children: [{ type: "heading", props: kv({ text: "Nossos pães" }) }, { type: "pricing", props: kv({ name: "Cesta", price: "[preço]", highlighted: "yes" }) }] },
    { type: "section", props: [], children: [] },
    { type: "footer", props: kv({ text: "© Padaria Sol" }), children: [] },
  ],
  notes: ["Preencha os preços."],
};

describe("GeneratedPageSchema", () => {
  it("é compatível com saída estruturada estrita", () => assertStrict(z.toJSONSchema(GeneratedPageSchema)));
});

describe("toDraft", () => {
  it("põe navbar no topo, ignora campos e opções inválidas, tira seção vazia e não herda textos padrão", () => {
    const d = toDraft(AI);
    expect(d.map((n) => n.type)).toEqual(["navbar", "hero", "section", "footer"]);
    expect(d[0].props.links).toBe("Pães\nEncomendas");
    expect(d[1].props).not.toHaveProperty("bogus");
    expect(d[1].props.cta).toBe("");
    expect(d[1].props.image).toBe("");
    expect(d[2].props.tone).toBe("default");
    const pricing = d[2].children![1];
    expect(pricing.props).toMatchObject({ name: "Cesta", price: "[preço]", highlighted: "yes", period: "", features: "" });
    // o rascunho gerado compila em A2UI válido
    expect(compileResponse(draftToExpress(d)).messages.length).toBeGreaterThan(0);
  });
});

describe("modelo sem IA", () => {
  it("monta seções pelas palavras do pedido, sem inventar fatos", () => {
    const d = templateFromPrompt("padaria de bairro com cardápio, depoimentos e formulário de encomenda e preços");
    expect(d.map((n) => n.type)).toEqual(["navbar", "hero", "section", "section", "section", "form", "footer"]);
    expect(d[1].props.title).toMatch(/^Padaria de bairro com cardápio.*…$/);
    expect(d[1].props.title.length).toBeLessThanOrEqual(70);
    expect(d[0].props.links.split("\n")).toEqual(["Produtos", "Depoimentos", "Planos", "Contato"]);
    const text = JSON.stringify(d);
    expect(text).not.toMatch(/R\$ ?\d|\d+h\b|Cliente feliz/);
    expect(text).toContain("[preço]");
  });

  it("pedido sem palavra-chave ainda gera uma página útil; reserva vira formulário de reserva", () => {
    expect(templateFromPrompt("loja legal").map((n) => n.type)).toEqual(["navbar", "hero", "section", "footer"]);
    const form = templateFromPrompt("restaurante com reserva").find((n) => n.type === "form")!;
    expect(form.props.fields).toBe("Nome\nTelefone\nData");
    const { messages } = compileResponse(draftToExpress(templateFromPrompt("salão com galeria, faq, sobre e planos")));
    expect(messages.length).toBeGreaterThan(0);
  });
});

describe("mergeGenerated", () => {
  const gen = templateFromPrompt("café com depoimentos");
  it("página única: substitui tudo", () => {
    expect(mergeGenerated(starterDraft(), gen, "replace", false)).toBe(gen);
  });
  it("várias páginas: mantém menu e rodapé do site", () => {
    const cur = starterDraft();
    const out = mergeGenerated(cur, gen, "replace", true);
    expect(chromeOf(out).navbar).toBe(chromeOf(cur).navbar);
    expect(chromeOf(out).footer).toBe(chromeOf(cur).footer);
    expect(out.some((n) => n.type === "hero" && n.props.title.startsWith("Café com"))).toBe(true);
  });
  it("acrescentar: entra antes do rodapé, sem menu/rodapé duplicado", () => {
    const cur = starterDraft();
    const out = mergeGenerated(cur, gen, "append", false);
    expect(out.filter((n) => n.type === "navbar")).toHaveLength(1);
    expect(out.filter((n) => n.type === "footer")).toHaveLength(1);
    expect(out[out.length - 1].type).toBe("footer");
    expect(out.length).toBe(cur.length + gen.length - 2);
  });
});

describe("POST /api/generate", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/generate/route");
    return POST(new Request("http://x/api/generate", { method: "POST", body: JSON.stringify(body) }));
  };
  it("mock usa o modelo automático", async () => {
    const res = await call({ prompt: "barbearia com planos", settings: { kind: "mock" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ provider: "mock", fallback: false });
    expect(json.draft.some((n: { type: string }) => n.type === "section")).toBe(true);
    expect(generateSource(json)).toMatch(/mock/);
  });
  it("pedido curto demais dá 400", async () => {
    expect((await call({ prompt: "a", settings: { kind: "mock" } })).status).toBe(400);
  });
});
