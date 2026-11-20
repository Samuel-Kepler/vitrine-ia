// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx, reactProject } from "@/lib/export/react";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { blockCatalog, toDraft } from "@/lib/draft/generate-shared";
import { findRecipe } from "@/lib/draft/recipes";
import { MenuItem, MenuList, formatPrice } from "./landing-components";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}, children?: DraftNode[]): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  if (children) x.children = children;
  return x;
};

const menu = (source: string) => [n("section", { source }, [n("heading", { text: "Cardápio" }), n("menuitem", { name: "[exemplo 1]", price: "[preço]" }), n("menuitem", { name: "[exemplo 2]", price: "[preço]" })])];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Cardápio ligado à API", () => {
  it("seção com rota vira MenuList com os itens de exemplo; sem rota, Grid comum", () => {
    const express = draftToExpress(menu("/menu-items"));
    expect(express).toMatch(/MenuList\(source="\/menu-items", children=\[[^\]]+\]\)/);
    expect(express).not.toContain("Grid(");
    const r = compileResponse(express);
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);

    expect(draftToExpress(menu(""))).not.toContain("MenuList");
    // rota inválida é ignorada (não vai para o A2UI nem para o código React)
    expect(draftToExpress(menu("javascript:alert(1)"))).not.toContain("MenuList");
    expect(draftToExpress(menu("/x\"); fetch(\"evil"))).not.toContain("MenuList");
  });

  it("o projeto React busca em VITE_API_URL + rota", () => {
    const { messages } = compileResponse(draftToExpress(menu("/menu-items")));
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages }, () => "#");
    expect(code).toContain('<MenuList endpoint={apiUrl("/menu-items")}>');
    expect(code).toContain("import.meta.env.VITE_API_URL");
    expect(code).toContain("<MenuItem ");
    const files = reactProject([{ name: "Início", file: "index.html", messages }]);
    expect(files.find((f) => f.path.endsWith(".env.example"))!.content).toContain("VITE_API_URL=http://localhost:3001");
    expect(files.find((f) => f.path.endsWith("vite-env.d.ts"))!.content).toContain("VITE_API_URL");
  });

  it("MenuList troca os exemplos pelos itens da API; com erro, mantém os exemplos", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([{ name: "Espresso", price: "7.5", description: "Curto", photo: "javascript:x" }]), { status: 200 })));
    await act(async () => {
      render(
        <MenuList endpoint="http://api.test/menu-items">
          <MenuItem name="[exemplo 1]" />
        </MenuList>,
      );
    });
    await waitFor(() => expect(screen.getByText("Espresso")).toBeTruthy());
    expect(screen.queryByText("[exemplo 1]")).toBeNull();
    expect(document.body.textContent).toContain(formatPrice("7.5")!);
    expect(document.querySelector("img")).toBeNull();
    cleanup();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    await act(async () => {
      render(
        <MenuList endpoint="http://api.test/menu-items">
          <MenuItem name="[exemplo 1]" />
        </MenuList>,
      );
    });
    expect(screen.getByText("[exemplo 1]")).toBeTruthy();
  });

  it("formata preço do banco e deixa texto livre como está", () => {
    expect(formatPrice(12)).toMatch(/R\$\s?12,00/);
    expect(formatPrice("9.9")).toMatch(/R\$\s?9,90/);
    expect(formatPrice("a combinar")).toBe("a combinar");
    expect(formatPrice(null)).toBeUndefined();
  });

  it("Sugerir da landing cria a tabela e a rota GET", () => {
    const s = inferFromDraft(menu("/menu-items"));
    const t = s.db.tables.find((x) => x.name === "menu_items");
    expect(t?.columns.map((c) => c.name)).toEqual(["id", "name", "description", "price", "photo", "active", "created_at"]);
    expect(s.arch.nodes.find((x) => x.kind === "api")?.routes).toContain("GET /menu-items");
    expect(inferFromDraft(menu("")).db.tables.some((x) => x.name === "menu_items")).toBe(false);
  });

  it("a IA não vê nem preenche o campo da rota", () => {
    expect(blockCatalog()).not.toContain("source");
    const d = toDraft({ blocks: [{ type: "section", props: [{ key: "source", value: "/menu-items" }], children: [{ type: "menuitem", props: [{ key: "name", value: "X" }] }] }], notes: [] });
    expect(d[0].props.source ?? "").toBe("");
  });

  it("a receita Cardápio da API já vem ligada", () => {
    const s = findRecipe("cardapio-api")!.build();
    expect(s.props.source).toBe("/menu-items");
    expect(draftToExpress([s])).toContain('MenuList(source="/menu-items"');
  });
});

describe("Cardápio da API no backend gerado", () => {
  it("GET /menu-items lê a tabela menu_items", async () => {
    const { expandArch, expandDb } = await import("@/lib/infer/expand");
    const { archFiles } = await import("@/lib/arch/codegen");
    const s = inferFromDraft(menu("/menu-items"));
    const files = archFiles(expandArch(s.arch), expandDb(s.db));
    const code = files.map((f) => f.content).join("\n");
    expect(code).toMatch(/app\.get\("\/menu-items"/);
    expect(code).toMatch(/menu_items/);
    expect(code).not.toMatch(/todo: "GET \/menu-items"/);
  });
});
