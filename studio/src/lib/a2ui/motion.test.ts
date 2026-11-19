import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";
import { systemPrompt, userPrompt } from "@/lib/reimagine/prompt";
import { MOTIONS } from "./themes";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  return x;
};
const page = () => [n("hero", { title: "Oi" }), n("logos", { title: "Clientes", names: "A\nB\nC\nD\nE", variant: "marquee" }), n("footer", { text: "©" })];

describe("movimento", () => {
  it.each(MOTIONS)("motion=%s compila e valida, e vai para o React", (motion) => {
    const express = draftToExpress(page(), { motion });
    expect(express).toContain(`motion="${motion}"`);
    expect(express).toContain('variant="marquee"');
    const r = compileResponse(express);
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    const { code } = pageToTsx({ name: "x", file: "index.html", messages: r.messages }, () => "#");
    expect(code).toContain(`motion={"${motion}"}`);
    expect(code).toContain('variant={"marquee"}');
  });

  it("CSS: rolagem sem JS, sequência só no animado, respeita 'menos movimento' e 'nenhum'", () => {
    const css = readFileSync("src/lib/a2ui/landing.css", "utf8");
    expect(css).toMatch(/@supports \(animation-timeline: view\(\)\)/);
    expect(css).toMatch(/\.lp:not\(\.lp-motion-none\) \.lp-reveal/);
    expect(css).toMatch(/\.lp-motion-lively \.lp-stagger > :nth-child\(2\)/);
    expect(css).toMatch(/prefers-reduced-motion: no-preference/);
    expect(css).toMatch(/\.lp-motion-none \.lp-marquee-track > \[aria-hidden="true"\]/);
  });

  it("prompt pede motion e explica quando usar", () => {
    expect(systemPrompt("")).toContain('motion="<none|calm|lively>"');
    expect(systemPrompt("")).toMatch(/"lively" para negócios alegres/);
    expect(userPrompt([], { motion: "none" })).toContain("Movimento obrigatório: none");
  });
});
