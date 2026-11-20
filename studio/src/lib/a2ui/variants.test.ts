import { describe, expect, it } from "vitest";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  return x;
};

const section = (kids: DraftNode[]): DraftNode => ({ ...createNode("section"), children: kids });

describe("estilos de Galeria, Número e Item de cardápio", () => {
  it("o estilo escolhido vai para o A2UI; 'A IA escolhe' não força nada", () => {
    const draft = [
      section([n("stat", { variant: "card" }), n("stat", { variant: "card" })]),
      section([n("menuitem", { name: "Bolo", variant: "card" }), n("menuitem", { name: "Café" })]),
      section([n("gallery", { variant: "mosaic" }), n("gallery", { variant: "strip" }), n("gallery")]),
    ];
    const express = draftToExpress(draft);
    expect(express).toMatch(/Stat\([^)]*variant="card"\)/);
    expect(express).toMatch(/MenuItem\(name="Bolo"[^)]*variant="card"\)/);
    expect(express).toMatch(/MenuItem\(name="Café"[^)]*\)/);
    expect(express).not.toMatch(/MenuItem\(name="Café"[^)]*variant/);
    expect(express).toContain('variant="mosaic"');
    expect(express).toContain('variant="strip"');
    expect(express).not.toContain('variant="auto"');
    const r = compileResponse(express);
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages: r.messages }, () => "#");
    expect(code).toContain('variant={"mosaic"}');
    expect(code).toContain('variant={"card"}');
  });

  it("o compilador recusa estilo que não existe", () => {
    const page = '<a2ui>\nroot = Page(child=col)\ncol = Column(children=[x])\nx = Gallery(images=[], variant="carousel")\n</a2ui>';
    expect(() => compileResponse(page)).toThrow(/carousel|variant/);
  });
});
