import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";
import { ART_DIRECTION, systemPrompt, userPrompt } from "@/lib/reimagine/prompt";
import { FEATURE_VARIANTS, HERO_VARIANTS, TESTIMONIAL_VARIANTS, THEMES, THEME_DEFS, fontLinks, fontsHref } from "./themes";

const node = (type: Parameters<typeof createNode>[0], props: Record<string, string>, children?: DraftNode[]): DraftNode => {
  const n = createNode(type);
  n.props = { ...n.props, ...props };
  if (children) n.children = children;
  return n;
};

function showcase(heroVariant: string): DraftNode[] {
  return [
    node("navbar", { brand: "Ateliê", links: "Sobre\nContato", cta: "Agendar" }),
    node("hero", { title: "Título", subtitle: "Sub", cta: "Ir", image: "https://example.com/a.jpg", variant: heroVariant }),
    node("section", { tone: "gradient" }, [node("heading", { text: "Benefícios" }), ...FEATURE_VARIANTS.map((v) => node("feature", { title: v, text: "t", variant: v }))]),
    node("section", { tone: "muted" }, TESTIMONIAL_VARIANTS.map((v) => node("testimonial", { quote: "q", author: "a", variant: v }))),
    node("footer", { text: "© Ateliê" }),
  ];
}

describe("temas e variações no A2UI", () => {
  it.each(THEMES)("tema %s com todas as variações compila e valida", (theme) => {
    for (const hv of HERO_VARIANTS) {
      const express = draftToExpress(showcase(hv), { palette: "forest", theme });
      expect(express).toContain(`theme="${theme}"`);
      expect(express).toContain(`variant="${hv}"`);
      const r = compileResponse(express);
      expect(r.messages.length, `${theme}/${hv}`).toBeGreaterThan(0);
      expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    }
  });

  it("estilo 'A IA escolhe' (auto) não vai para o A2UI; image-bg sem imagem também não", () => {
    const express = draftToExpress([node("hero", { title: "x", variant: "auto" }), node("hero", { title: "y", variant: "image-bg" })]);
    expect(express).not.toMatch(/variant="(auto|image-bg)"/);
  });

  it("exportação React leva tema e variações", () => {
    const { messages } = compileResponse(draftToExpress(showcase("gradient"), { theme: "elegante" }));
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages }, () => "#");
    expect(code).toContain('theme={"elegante"}');
    expect(code).toContain('<Hero title={"Título"}');
    expect(code).toContain('variant={"gradient"}');
    expect(code).toContain('variant={"icon-left"}');
    expect(code).toContain('variant={"quote"}');
  });
});

describe("fontes e CSS dos temas", () => {
  it("Google Fonts: todas no preview, só as do tema na exportação", () => {
    expect(fontsHref()).toContain("Playfair+Display");
    expect(fontsHref()).toContain("Space+Grotesk");
    const links = fontLinks("editorial");
    expect(links).toContain("Libre+Bodoni");
    expect(links).not.toContain("Playfair");
  });
  it("cada tema tem classe com fonte de título e de texto", () => {
    const css = readFileSync("src/lib/a2ui/landing.css", "utf8");
    for (const t of THEMES) {
      const block = css.match(new RegExp(`\.lp-theme-${t}[^{]*\{([^}]*)\}`))?.[1] ?? "";
      expect(block, t).toContain(`"${THEME_DEFS[t].heading}"`);
      expect(block, t).toContain("--lp-font-body");
    }
    expect(css).toMatch(/\.lp-bento > :first-child/);
    expect(css).toMatch(/\.tone-gradient \.lp-btn/);
  });
});

describe("paletas no CSS da landing", () => {
  const varsOf = (css: string, name: string) => {
    const block = css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    return [...block.matchAll(/(--lp-[\w-]+)\s*:/g)].map((m) => m[1]).sort();
  };
  it("noir, espresso e rose existem e têm as mesmas variáveis que sunset", () => {
    const css = readFileSync("src/lib/a2ui/landing.css", "utf8");
    const base = varsOf(css, "lp-sunset");
    expect(base.length).toBeGreaterThan(0);
    for (const p of ["lp-noir", "lp-espresso", "lp-rose"]) {
      expect(css, p).toContain(`.${p} {`);
      expect(varsOf(css, p), p).toEqual(base);
    }
  });
});

describe("prompt do Reimaginar", () => {
  it("pede tema e traz a direção de arte", () => {
    const sys = systemPrompt("");
    expect(sys).toContain('theme="<moderno|elegante|editorial|suave|tech>"');
    expect(sys).toContain(ART_DIRECTION);
    expect(userPrompt([], { theme: "suave" })).toContain("Tema obrigatório: suave");
    expect(userPrompt([], {})).toMatch(/Tema: escolha/);
  });
});
