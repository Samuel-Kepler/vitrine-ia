import { describe, expect, it } from "vitest";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";
import { photoSlots } from "@/lib/photos/auto";
import { checkFacts } from "@/lib/reimagine/fact-check";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}, children?: DraftNode[]): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  if (children) x.children = children;
  return x;
};

const draft = () => [
  n("section", {}, [
    n("heading", { text: "Cardápio" }),
    n("menuitem", { name: "Espresso", description: "Grão da casa", price: "R$ 7", photo: "https://example.com/e.jpg" }),
    n("menuitem", { name: "Pão de queijo", description: "", price: "R$ 5", photo: "javascript:alert(1)" }),
    n("menuitem", { name: "Cappuccino", price: "R$ 12" }),
  ]),
];

describe("Item de cardápio", () => {
  it("vira MenuItem em Grid de 2 colunas e compila sem erro", () => {
    const express = draftToExpress(draft());
    expect(express).toMatch(/Grid\(children=\[[^\]]+\], columns="2"\)/);
    expect(express).toContain('MenuItem(name="Espresso", price="R$ 7", description="Grão da casa", photo="https://example.com/e.jpg")');
    expect(express).not.toContain("javascript:");
    const r = compileResponse(express);
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    expect(JSON.stringify(r.messages)).toContain('"MenuItem"');
    expect(checkFacts(r.messages, draft())).toEqual([]);
  });

  it("vai para o projeto React", () => {
    const { messages } = compileResponse(draftToExpress(draft()));
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages }, () => "#");
    expect(code).toContain("<MenuItem ");
    expect(code).toContain('price={"R$ 7"}');
    expect(code).not.toMatch(/não exportado/);
  });

  it("pede foto só para item com nome de verdade e sem foto", () => {
    const slots = photoSlots([n("menuitem", { name: "Cappuccino", description: "com canela", photo: "" }), n("menuitem", { name: "[produto 1]", photo: "" }), n("menuitem", { name: "Bolo", photo: "https://x.com/b.jpg" })]);
    expect(slots.map((s) => `${s.key}:${s.text}`)).toEqual(["photo:Cappuccino. com canela"]);
  });
});
