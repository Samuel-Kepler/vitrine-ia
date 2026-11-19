import { beforeEach, describe, expect, it } from "vitest";
import { useStudio } from "./store";
import { starterDraft } from "./starter";
import { addLink, applyChrome, chromeOf, HOME_ID, migrateStudio, pageForLink, uniqueSlug } from "./pages";
import { pageBrief } from "@/components/studio/reimagine-client";
import type { ReimagineResult } from "@/lib/reimagine/reimagine";

const st = () => useStudio.getState();
const links = () => st().tree.find((n) => n.type === "navbar")!.props.links.split("\n");
const fakeResult = (note: string) => ({ note }) as unknown as ReimagineResult;

beforeEach(() => {
  useStudio.setState({ tree: starterDraft(), result: null, pages: [{ id: HOME_ID, name: "Início", slug: "inicio", tree: [], result: null }], pageId: HOME_ID, tab: "canvas" });
});

describe("helpers", () => {
  it("slug único, link sem duplicar e página pelo texto do link", () => {
    const pages = [{ id: "a", slug: "cardapio" }];
    expect(uniqueSlug("Cardápio", pages)).toBe("cardapio-2");
    expect(uniqueSlug("Cardápio", pages, "a")).toBe("cardapio");
    const tree = addLink(starterDraft(), "cardapio");
    expect(tree[0].props.links.split("\n")).toEqual(["Cardápio", "Sobre", "Contato"]);
    expect(pageForLink([{ id: "x", name: "Cardápio", slug: "cardapio", tree: [], result: null }], " cardapio ")?.id).toBe("x");
  });

  it("applyChrome troca menu e rodapé e insere se faltar", () => {
    const chrome = chromeOf(starterDraft());
    const out = applyChrome([], chrome);
    expect(out.map((n) => n.type)).toEqual(["navbar", "footer"]);
  });
});

describe("store: páginas", () => {
  it("nova página herda menu/rodapé, ganha link no menu e abre vazia de resultado", () => {
    st().setResult(fakeResult("home"));
    st().addPage("Galeria");
    const p = st().pages.find((x) => x.name === "Galeria")!;
    expect(st().pageId).toBe(p.id);
    expect(p.slug).toBe("galeria");
    expect(st().result).toBeNull();
    expect(st().tree.map((n) => n.type)).toEqual(["navbar", "section", "footer"]);
    expect(links()).toContain("Galeria");
    // a página inicial guardou o resultado dela
    expect(st().pages[0].result).toMatchObject({ note: "home" });
  });

  it("trocar de página preserva o rascunho de cada uma e espalha o menu editado", () => {
    st().addPage("Galeria");
    const galeria = st().pageId;
    const nav = st().tree.find((n) => n.type === "navbar")!;
    st().update(nav.id, { ...nav.props, brand: "Aurora Café" });
    const section = st().tree.find((n) => n.type === "section")!;
    st().update(section.id, { tone: "dark" });
    st().switchPage(HOME_ID);
    expect(st().tree.find((n) => n.type === "navbar")!.props.brand).toBe("Aurora Café");
    expect(st().tree.some((n) => n.type === "hero")).toBe(true);
    st().switchPage(galeria);
    expect(st().tree.find((n) => n.type === "section")!.props.tone).toBe("dark");
  });

  it("renomear atualiza o link; apagar remove a página e o link", () => {
    st().addPage("Galeria");
    const id = st().pageId;
    st().renamePage(id, "Fotos");
    expect(links()).toContain("Fotos");
    expect(links()).not.toContain("Galeria");
    expect(st().pages.find((p) => p.id === id)!.slug).toBe("fotos");
    st().removePage(id);
    expect(st().pages).toHaveLength(1);
    expect(st().pageId).toBe(HOME_ID);
    expect(links()).not.toContain("Fotos");
    st().removePage(HOME_ID); // a última não sai
    expect(st().pages).toHaveLength(1);
  });

  it("duplicar copia o rascunho com nome novo", () => {
    st().duplicatePage(HOME_ID);
    expect(st().pages.map((p) => p.name)).toEqual(["Início", "Início (cópia)"]);
    expect(st().tree.some((n) => n.type === "hero")).toBe(true);
    expect(links()).toContain("Início (cópia)");
  });

  it("desfazer não atravessa páginas", () => {
    st().addPage("Galeria");
    expect(useStudio.temporal.getState().pastStates).toHaveLength(0);
  });

  it("Reimaginar avisa a IA de qual página é", () => {
    expect(pageBrief({ ...st(), brief: "café" })).toBe("café");
    st().addPage("Galeria");
    expect(pageBrief({ ...st(), brief: "café" })).toMatch(/^café\nEsta é a página "Galeria" de um site com as páginas: Início, Galeria/);
  });

  it("rascunho salvo da versão 1 vira a página Início", () => {
    const tree = starterDraft();
    const out = migrateStudio({ tree, result: null }, 1);
    expect(out.pageId).toBe(HOME_ID);
    expect((out.pages as { name: string; tree: unknown }[])[0]).toMatchObject({ name: "Início", tree });
  });
});
