import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { ARCH_NODE, layoutArch, layoutDb, TABLE_WIDTH } from "./auto";

const overlap = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) => Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h;

describe("auto-layout", () => {
  it("arquitetura: quem chama fica à esquerda de quem é chamado, sem sobreposição", () => {
    const g = layoutArch(expandArch(inferFromDraft(starterDraft()).arch));
    const pos = new Map(g.nodes.map((n) => [n.id, n.position]));
    for (const e of g.edges) expect(pos.get(e.source)!.x).toBeLessThan(pos.get(e.target)!.x);
    for (const a of g.nodes) for (const b of g.nodes) if (a !== b) expect(overlap(a.position, b.position, ARCH_NODE.width, ARCH_NODE.height)).toBe(false);
  });

  it("banco: tabela pai à esquerda da filha, sem sobreposição horizontal na mesma coluna", () => {
    const m = layoutDb(expandDb(inferFromDraft(starterDraft()).db));
    const pos = new Map(m.tables.map((t) => [t.id, t.position]));
    for (const r of m.relations) expect(pos.get(r.to)!.x).toBeLessThan(pos.get(r.from)!.x);
    for (const a of m.tables) for (const b of m.tables) if (a !== b) expect(overlap(a.position, b.position, TABLE_WIDTH, 60)).toBe(false);
  });

  it("vazio não quebra", () => {
    expect(layoutArch({ nodes: [], edges: [] }).nodes).toEqual([]);
    expect(layoutDb({ tables: [], relations: [] }).tables).toEqual([]);
  });
});
