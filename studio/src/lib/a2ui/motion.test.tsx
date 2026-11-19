import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";
import { systemPrompt, userPrompt } from "@/lib/reimagine/prompt";
import { MOTIONS, SECTION_ANIMATIONS } from "./themes";
import { renderToStaticMarkup } from "react-dom/server";
import { Section } from "./landing-components";

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

describe("animação por seção", () => {
  const section = (animation: string) => {
    const s = n("section", { animation });
    s.children = [n("heading", { text: "Benefícios" }), n("text", { text: "Texto" })];
    return s;
  };
  const sectionOf = (messages: unknown[]) =>
    ((messages.find((m) => "createSurface" in (m as object)) as any).createSurface.components as any[]).find((c) => c.component === "Section" && c.tone);

  it.each(SECTION_ANIMATIONS)("animation=%s: rascunho -> A2UI validado -> React", (animation) => {
    const express = draftToExpress([n("hero", { title: "Oi" }), section(animation), n("footer", { text: "©" })]);
    expect(express).toContain(`animation="${animation}"`);
    const r = compileResponse(express);
    expect(sectionOf(r.messages).animation).toBe(animation);
    const { code } = pageToTsx({ name: "x", file: "index.html", messages: r.messages }, () => "#");
    expect(code).toContain(`animation={"${animation}"}`);
  });

  it("'auto' no rascunho não vai para o A2UI (o Reimaginar ou o padrão decidem)", () => {
    const express = draftToExpress([section("auto")]);
    expect(express).not.toContain("animation=");
    expect(sectionOf(compileResponse(express).messages).animation).toBeUndefined();
  });

  it("valor fora da lista é recusado pelo compilador (a IA corrige)", () => {
    expect(() => compileResponse('<a2ui>\nroot = Page(child=c)\nc = Column(children=[s])\ns = Section(child=t, animation="explode")\nt = Text(text="x")\n</a2ui>')).toThrow();
  });

  it("componente aplica a classe; sem animação não põe classe", () => {
    expect(renderToStaticMarkup(<Section animation="zoom">x</Section>)).toContain("lp-anim-zoom");
    expect(renderToStaticMarkup(<Section>x</Section>)).not.toContain("lp-anim-");
  });

  it("CSS: cada animação tem regra e keyframes, tudo sob 'menos movimento' e desligável", () => {
    const css = readFileSync("src/lib/a2ui/landing.css", "utf8");
    const guarded = css.slice(css.indexOf("@supports (animation-timeline: view())"));
    for (const a of ["slide", "zoom", "blur"]) {
      expect(guarded).toMatch(new RegExp(`\\.lp:not\\(\\.lp-motion-none\\) \\.lp-anim-${a} \\.lp-reveal`));
      expect(css).toContain(`@keyframes lp-${a}`);
    }
    expect(css).toMatch(/\.lp-anim-none \.lp-reveal,\s*\.lp-anim-none \.lp-stagger > \*,\s*\.lp-anim-none \.lp-img/);
    expect(css).toMatch(/\.lp:not\(\.lp-motion-none\) \.lp-reveal \.lp-img/);
    expect(css).toMatch(/\.lp:not\(\.lp-motion-none\) \.lp-hero-image/);
    // as regras novas ficam dentro do bloco que exige prefers-reduced-motion: no-preference
    const block = guarded.slice(0, guarded.indexOf("@keyframes lp-slide"));
    expect(block).toMatch(/@media \(prefers-reduced-motion: no-preference\)[\s\S]*lp-anim-slide[\s\S]*lp-hero-image/);
  });

  it("prompt explica quando variar a animação", () => {
    expect(systemPrompt("")).toMatch(/Section\.animation/);
    expect(systemPrompt("")).toMatch(/"zoom" em seções com Gallery/);
  });
});
