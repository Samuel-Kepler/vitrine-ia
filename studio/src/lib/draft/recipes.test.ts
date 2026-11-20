import { describe, expect, it } from "vitest";
import { RECIPES, recipeHints } from "./recipes";
import { BLOCKS } from "./blocks";
import { DraftNodeSchema } from "./tree";
import { CHILD_TYPES, generateSystem } from "./generate-shared";
import { draftToExpress } from "./to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";

describe("receitas de seção", () => {
  it("tem 15 a 20 receitas com ids únicos", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(15);
    expect(RECIPES.length).toBeLessThanOrEqual(20);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
  });

  it.each(RECIPES.map((r) => [r.id, r] as const))("%s: seção válida, só campos e filhos que existem", (_id, r) => {
    const s = r.build();
    expect(DraftNodeSchema.safeParse(s).success).toBe(true);
    expect(s.type).toBe("section");
    expect(s.children?.length).toBeGreaterThan(0);
    for (const c of s.children ?? []) {
      expect((CHILD_TYPES as readonly string[]).includes(c.type), c.type).toBe(true);
      expect(c.children).toBeUndefined();
      for (const [k, v] of Object.entries(c.props)) {
        const f = BLOCKS[c.type].fields.find((x) => x.key === k);
        expect(f, `${c.type}.${k}`).toBeDefined();
        if (f?.options) expect(f.options.map((o) => o.value), `${c.type}.${k}`).toContain(v);
      }
    }
  });

  it("cada build gera ids novos", () => {
    const a = RECIPES[0].build();
    const b = RECIPES[0].build();
    expect(a.id).not.toBe(b.id);
    expect(a.children![0].id).not.toBe(b.children![0].id);
  });

  it("todas juntas compilam no A2UI e exportam para React", () => {
    const draft = RECIPES.map((r) => r.build());
    const r = compileResponse(draftToExpress(draft));
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages: r.messages }, () => "#");
    expect(code).not.toMatch(/não exportado/);
  });

  it("aparecem no prompt de geração", () => {
    expect(recipeHints()).toContain("Cardápio com preços (tone default): heading, text, menuitem×4");
    expect(generateSystem(2026)).toContain("Horário e localização");
  });
});
