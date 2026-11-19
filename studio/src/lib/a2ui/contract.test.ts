// Testes de contrato do A2UI.
//
// O servidor valida a saída da IA com @a2ui/agent; o navegador renderiza com
// @a2ui/web_core (MessageProcessor). Os pacotes são pré-1.0, então um upgrade
// pode fazer os dois lados discordarem sem nenhum erro de tipo. Estes testes
// quebram nesse caso, antes de chegar ao usuário.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import { compileResponse } from "./agent";
import { CATALOG_ID, CUSTOM_APIS, SURFACE_ID, buildCatalog } from "./catalog-api";
import { draftToExpress } from "@/lib/draft/to-express";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { BLOCK_TYPES } from "@/lib/draft/blocks";
import { starterDraft } from "@/lib/draft/starter";

function everyBlock(): DraftNode[] {
  const section = createNode("section");
  section.children = BLOCK_TYPES.filter((t) => !["section", "navbar", "hero", "footer"].includes(t)).map((t) => {
    const n = createNode(t);
    if (n.children) n.children.push(createNode("text"));
    return n;
  });
  return [createNode("navbar"), createNode("hero"), section, createNode("feature"), createNode("footer")];
}

/** Renderer do navegador, sem React: mesmo processador e mesmos schemas. */
function render(messages: unknown) {
  const proc = new MessageProcessor([buildCatalog(CUSTOM_APIS)]);
  const errors = proc.processMessagesWithErrors(messages);
  return { proc, errors };
}

describe("contrato servidor (@a2ui/agent) x renderer (@a2ui/web_core)", () => {
  it.each([
    ["todos os blocos", () => everyBlock()],
    ["rascunho inicial", () => starterDraft()],
    ["rascunho vazio", () => []],
  ])("o renderer aceita o que o compilador aprova: %s", (_, draft) => {
    const { messages } = compileResponse(draftToExpress(draft(), { palette: "ocean" }));
    const { proc, errors } = render(messages);
    expect(errors).toEqual([]);
    const surface = proc.getSurface(SURFACE_ID);
    expect(surface).toBeDefined();

    const created = (messages.find((m) => "createSurface" in m) as any).createSurface;
    expect(created.catalogId).toBe(CATALOG_ID);
    for (const c of created.components) expect(surface!.componentsModel.get(c.id), c.id).toBeDefined();
  });

  const tamper = (mut: (components: any[]) => void) => {
    const { messages } = compileResponse(draftToExpress(starterDraft()));
    const copy = structuredClone(messages) as any[];
    mut(copy.find((m) => "createSurface" in m).createSurface.components);
    return render(copy).errors;
  };
  const hero = (c: any[]) => c.find((x) => x.component === "Hero");

  it.each([
    ["prop com tipo errado", (c: any[]) => (hero(c).title = 42)],
    ["prop obrigatória ausente", (c: any[]) => delete hero(c).title],
    ["enum fora da lista", (c: any[]) => (c.find((x) => x.id === "root").palette = "neon")],
    ["URL de imagem insegura", (c: any[]) => (hero(c).image = "javascript:alert(1)")],
  ])("o renderer também recusa: %s", (_, mut) => {
    const errors = tamper(mut);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].error.code).toBe("VALIDATION_FAILED");
  });

  it("componente fora do catálogo: o renderer NÃO recusa; quem barra é o compilador", () => {
    // Comportamento do web_core 0.15. Se mudar num upgrade, revise agent.test.ts
    // ("rejects unknown components"), que hoje é a única barreira.
    expect(tamper((c) => c.push({ id: "x", component: "Carousel" }))).toEqual([]);
    expect(() => compileResponse("<a2ui>\nroot = Page(child=x)\nx = Carousel(items=[])\n</a2ui>")).toThrow(/Carousel/);
  });
});

describe("versões fixas dos pacotes @a2ui", () => {
  const root = join(__dirname, "..", "..", "..");
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const a2ui = Object.entries<string>(pkg.dependencies).filter(([n]) => n.startsWith("@a2ui/"));

  it("package.json declara versão exata (sem ^ ou ~)", () => {
    expect(a2ui.length).toBeGreaterThan(0);
    for (const [name, v] of a2ui) expect(v, name).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("a versão instalada é a declarada", () => {
    for (const [name, v] of a2ui) {
      // Os pacotes não exportam ./package.json: lê direto do node_modules.
      const installed = JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version;
      expect(installed, name).toBe(v);
    }
  });
});
