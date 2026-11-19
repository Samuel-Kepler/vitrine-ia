import { beforeEach, describe, expect, it } from "vitest";
import { createNode, findNode, type DraftNode } from "./tree";
import { fitSketch, mergeHeadingOnly, sketchPrompt, sketchSystem, templateFromSketch } from "./sketch-shared";
import { useStudio } from "./store";
import { HOME_ID } from "./pages";
import { summarize } from "@/components/studio/SketchDialog";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}, children?: DraftNode[]): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  if (children) x.children = children;
  return x;
};
const generated = () => [n("section", {}, [n("heading", { text: "Diferenciais" })]), n("section", {}, [n("feature"), n("feature"), n("feature")])];

describe("encaixe do resultado do desenho", () => {
  it("junta a seção que só tem título com a seguinte", () => {
    const out = mergeHeadingOnly(generated());
    expect(out).toHaveLength(1);
    expect(out[0].children!.map((c) => c.type)).toEqual(["heading", "feature", "feature", "feature"]);
  });
  it("no topo entram seções; dentro de um container, só o conteúdo", () => {
    const g = mergeHeadingOnly(generated());
    expect(fitSketch(g, false).map((x) => x.type)).toEqual(["section"]);
    expect(fitSketch(g, true).map((x) => x.type)).toEqual(["heading", "feature", "feature", "feature"]);
    expect(fitSketch([n("navbar"), ...g, n("footer")], false).map((x) => x.type)).toEqual(["section"]);
  });
  it("sem visão: usa a descrição; sem nada, um bloco neutro com marcadores", () => {
    const byText = templateFromSketch("Equipe", "nossos barbeiros");
    expect(byText.flatMap((x) => x.children ?? []).some((c) => c.type === "team")).toBe(true);
    const neutral = templateFromSketch("", "");
    expect(neutral[0].children!.map((c) => c.props.text)).toEqual(["[título da seção]", "[conteúdo desta seção]"]);
  });
  it("prompt explica como ler o desenho e não inventar", () => {
    expect(sketchSystem()).toMatch(/Retângulos lado a lado = cards/);
    expect(sketchSystem()).toMatch(/NÃO INVENTE FATOS/);
    expect(sketchPrompt("três cards", "barbearia", false)).toContain("Sem imagem");
  });
  it("resumo do que vai entrar", () => {
    expect(summarize(mergeHeadingOnly(generated()))).toEqual(["Seção: Título, Benefício ×3"]);
  });
});

describe("store.applySketch", () => {
  beforeEach(() => {
    const custom = n("custom", { name: "Diferenciais" });
    custom.id = "livre";
    const sec = n("section", {}, [n("heading"), Object.assign(n("custom"), { id: "livre2" })]);
    useStudio.setState({ tree: [n("navbar"), custom, sec, n("footer")], pages: [{ id: HOME_ID, name: "Início", slug: "inicio", tree: [], result: null }], pageId: HOME_ID, sketches: { livre: "data:image/png;base64,AAAA" } });
    useStudio.temporal.getState().clear();
  });
  it("no topo: troca o Bloco livre pela seção, apaga o desenho e o Ctrl+Z desfaz", () => {
    useStudio.getState().applySketch("livre", mergeHeadingOnly(generated()));
    const s = useStudio.getState();
    expect(s.tree.map((x) => x.type)).toEqual(["navbar", "section", "section", "footer"]);
    expect(findNode(s.tree, "livre")).toBeUndefined();
    expect(s.sketches.livre).toBeUndefined();
    expect(s.selectedId).toBe(s.tree[1].id);
    useStudio.temporal.getState().undo();
    expect(findNode(useStudio.getState().tree, "livre")).toBeDefined();
  });
  it("dentro de uma seção: entra só o conteúdo", () => {
    useStudio.getState().applySketch("livre2", mergeHeadingOnly(generated()));
    const sec = useStudio.getState().tree[2];
    expect(sec.children!.map((c) => c.type)).toEqual(["heading", "heading", "feature", "feature", "feature"]);
  });
});

describe("POST /api/sketch", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/sketch/route");
    return POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));
  };
  it("recusa imagem que não é data URL de imagem e pedido vazio", async () => {
    expect((await call({ image: "https://evil.example/x.png", settings: { kind: "mock" } })).status).toBe(400);
    expect((await call({ settings: { kind: "mock" } })).status).toBe(400);
  });
  it("mock monta pela descrição", async () => {
    const res = await call({ image: "data:image/png;base64,iVBORw0KGgo=", name: "Perguntas", description: "perguntas frequentes", settings: { kind: "mock" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("mock");
    expect(JSON.stringify(json.draft)).toContain('"faq"');
  });
});
