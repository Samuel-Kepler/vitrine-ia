import { describe, expect, it } from "vitest";
import { compileResponse, promptSnippet } from "./agent";
import { draftToExpress } from "@/lib/draft/to-express";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { BLOCK_TYPES } from "@/lib/draft/blocks";
import { CATALOG_ID, SURFACE_ID } from "./catalog-api";

function everyBlock(): DraftNode[] {
  const section = createNode("section");
  section.children = BLOCK_TYPES.filter((t) => !["section", "navbar", "hero", "footer"].includes(t)).map((t) => {
    const n = createNode(t);
    if (n.children) n.children.push(createNode("text"));
    return n;
  });
  return [createNode("navbar"), createNode("hero"), section, createNode("feature"), createNode("feature"), createNode("footer")];
}

describe("A2UI agent", () => {
  it("prompt lists our custom components", () => {
    const p = promptSnippet();
    for (const name of ["Page(", "Hero(", "Grid(", "PricingCard("]) expect(p).toContain(name);
  });

  it("compiles every draft block to valid v1.0 messages", () => {
    const express = draftToExpress(everyBlock(), { palette: "sunset" });
    const { messages } = compileResponse(`Pronto.\n${express}`);
    const create = messages.find((m) => "createSurface" in m)!.createSurface as any;
    expect(create.surfaceId).toBe(SURFACE_ID);
    expect(create.catalogId).toBe(CATALOG_ID);
    const root = create.components.find((c: any) => c.id === "root");
    expect(root.component).toBe("Page");
    expect(root.palette).toBe("sunset");
    const names = new Set(create.components.map((c: any) => c.component));
    for (const n of ["Navbar", "Hero", "Section", "Grid", "Feature", "Footer", "TextField", "PricingCard"]) expect(names).toContain(n);
  });

  it("empty draft still compiles", () => {
    expect(() => compileResponse(draftToExpress([]))).not.toThrow();
  });

  it("rejects unknown components with an actionable error", () => {
    expect(() => compileResponse('<a2ui>\nroot = Page(child=x)\nx = Carousel(items=[])\n</a2ui>')).toThrow(/Carousel/);
  });
});
