import { describe, expect, it } from "vitest";
import { MessageProcessor } from "@a2ui/web_core/v1_0";
import { compileResponse } from "@/lib/a2ui/agent";
import { CUSTOM_APIS, buildCatalog } from "@/lib/a2ui/catalog-api";
import { draftToExpress } from "@/lib/draft/to-express";
import { createNode } from "@/lib/draft/tree";
import { useStudio } from "@/lib/draft/store";
import { ASSET_PREFIX, assetUrl, decodeDataUrl, exportAssetFiles, fitSize, isAssetUrl, referencedAssets, resolveAssets } from "./assets";

// PNG 1x1 de verdade.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const assets = { img_aa: PNG };

describe("endereços de imagem do usuário", () => {
  it("resolve em qualquer JSON e mantém ids desconhecidos", () => {
    const msg = [{ c: { image: assetUrl("img_aa"), images: [assetUrl("img_aa"), assetUrl("img_zz")], title: "Oi" } }];
    const out = resolveAssets(msg, assets);
    expect(out[0].c.image).toBe(PNG);
    expect(out[0].c.images).toEqual([PNG, assetUrl("img_zz")]);
    expect(out[0].c.title).toBe("Oi");
    expect(msg[0].c.image).toBe(assetUrl("img_aa")); // não altera o original
  });

  it("lista os ids citados", () => {
    expect([...referencedAssets({ a: `x ${assetUrl("img_aa")} y`, b: [assetUrl("img_bb")] })].sort()).toEqual(["img_aa", "img_bb"]);
    expect(isAssetUrl(`${ASSET_PREFIX}img_aa`)).toBe(true);
    expect(isAssetUrl("https://exemplo.com/a.png")).toBe(false);
  });

  it("reduz mantendo a proporção", () => {
    expect(fitSize(4000, 2000)).toEqual({ w: 1600, h: 800 });
    expect(fitSize(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

describe("rascunho com imagem enviada -> A2UI -> renderer", () => {
  it("a IA/compilador vê só o endereço curto; o renderer aceita a imagem resolvida", () => {
    const hero = createNode("hero");
    hero.props.title = "Café";
    hero.props.image = assetUrl("img_aa");
    const gallery = createNode("gallery");
    gallery.props.images = `${assetUrl("img_aa")}\nhttps://exemplo.com/b.jpg`;
    const section = createNode("section");
    section.children = [gallery];

    const express = draftToExpress([hero, section]);
    expect(express).toContain(assetUrl("img_aa"));
    expect(express).not.toContain("base64"); // nada pesado no que vai para a IA

    const { messages } = compileResponse(express);
    const resolved = resolveAssets(messages, assets);
    expect(JSON.stringify(resolved)).toContain(PNG);
    const errors = new MessageProcessor([buildCatalog(CUSTOM_APIS)]).processMessagesWithErrors(resolved);
    expect(errors).toEqual([]);
  });
});

describe("zip do projeto React", () => {
  it("vira arquivo em public/images e o código aponta para /images", () => {
    const files = [
      { path: "react/src/pages/Inicio.tsx", content: `<Hero image="${assetUrl("img_aa")}" />` },
      { path: "web/index.html", content: "<img src='data:image/png;base64,xx'>" },
    ];
    const out = exportAssetFiles(files, assets, "react/");
    expect(out[0].content).toBe('<Hero image="/images/img_aa.png" />');
    expect(out[1]).toEqual(files[1]);
    const bin = out.find((f) => f.path === "react/public/images/img_aa.png")!;
    expect(bin.content).toBeInstanceOf(Uint8Array);
    expect(Array.from((bin.content as Uint8Array).slice(1, 4), (c) => String.fromCharCode(c)).join("")).toBe("PNG");
  });

  it("sem imagens: devolve os arquivos como estão; data URL inválido é recusado", () => {
    const files = [{ path: "src/a.tsx", content: "x" }];
    expect(exportAssetFiles(files, assets)).toBe(files);
    expect(decodeDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(decodeDataUrl("data:text/html;base64,PGI+")).toBeNull();
  });
});

describe("store: addAsset", () => {
  it("guarda, reaproveita a mesma imagem e descarta as que nenhuma página usa", () => {
    const st = useStudio.getState();
    st.loadProjectData({ ...st.projectData(), tree: [], pages: [{ id: "home", name: "Início", slug: "inicio", tree: [], result: null }], pageId: "home", assets: {} });

    const a = useStudio.getState().addAsset(PNG);
    expect(isAssetUrl(a)).toBe(true);
    expect(useStudio.getState().addAsset(PNG)).not.toBe(a); // a não estava em uso: foi limpa e recriada

    const hero = createNode("hero");
    const url = useStudio.getState().addAsset(PNG);
    hero.props.image = url;
    useStudio.getState().reset([hero]);
    expect(useStudio.getState().addAsset(PNG)).toBe(url); // em uso: reaproveita
    const other = useStudio.getState().addAsset(PNG.replace("AAAA", "AAAB"));
    expect(Object.keys(useStudio.getState().assets).sort()).toEqual([url, other].map((u) => u.slice(ASSET_PREFIX.length)).sort());
  });
});
