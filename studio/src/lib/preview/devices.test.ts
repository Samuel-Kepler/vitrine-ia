import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CUSTOM, DEVICES, FIT, clampWidth, fitScale, groupOf, resolveViewport } from "./devices";

describe("tamanhos de tela", () => {
  it("tem celulares, tablets e desktops com ids únicos", () => {
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length);
    for (const g of ["Celular", "Tablet", "Desktop"]) expect(DEVICES.filter((d) => d.group === g).length).toBeGreaterThanOrEqual(3);
  });

  it("resolve aparelho, girado, personalizado e ajustar", () => {
    expect(resolveViewport({ device: FIT, customWidth: 900, rotated: false })).toBeNull();
    expect(resolveViewport({ device: "iphone-15", customWidth: 0, rotated: false })).toMatchObject({ width: 393, height: 852 });
    expect(resolveViewport({ device: "iphone-15", customWidth: 0, rotated: true })).toMatchObject({ width: 852, height: 393 });
    expect(resolveViewport({ device: CUSTOM, customWidth: 50, rotated: false })).toMatchObject({ width: 280, height: null });
    expect(clampWidth(99999)).toBe(2560);
    expect(groupOf({ device: "ipad-air", customWidth: 0, rotated: false })).toBe("Tablet");
  });

  it("encolhe para caber e nunca aumenta", () => {
    expect(fitScale({ width: 1920, height: 1080 }, { width: 960, height: 2000 })).toBe(0.5);
    expect(fitScale({ width: 393, height: 852 }, { width: 1200, height: 426 })).toBe(0.5);
    expect(fitScale({ width: 393, height: null }, { width: 1200, height: 100 })).toBe(1);
  });

  it("a landing usa container queries, não breakpoints da janela", () => {
    const views = readFileSync("src/lib/a2ui/landing-components.tsx", "utf8");
    expect(views).not.toMatch(/[\s"`](sm|md|lg|xl):/);
    expect(views).toMatch(/@3xl:/);
    expect(readFileSync("src/lib/a2ui/landing.css", "utf8")).toMatch(/\.lp \{[^}]*container-type: inline-size/);
  });
});

describe("landing responsiva", () => {
  const views = readFileSync("src/lib/a2ui/landing-components.tsx", "utf8");
  const css = readFileSync("src/lib/a2ui/landing.css", "utf8");
  it("menu do celular com <details> (funciona sem JS no HTML exportado)", () => {
    expect(views).toMatch(/<details className="lp-menu @3xl:hidden">/);
    expect(views).toMatch(/aria-label="Abrir menu"/);
    expect(css).toMatch(/\.lp-menu\[open\] \.lp-menu-close/);
  });
  it("espaçamentos e títulos crescem por etapa; botões com 44px; sem rolagem lateral", () => {
    expect(views).toMatch(/px-5 py-14 @3xl:px-6 @3xl:py-20/);
    expect(views).toMatch(/text-\[2rem\][^"]*@md:text-4xl[^"]*@3xl:text-5xl[^"]*@5xl:text-6xl/);
    // botões/cards em @layer components: "hidden"/"@md:hidden" do Tailwind precisam vencer
    expect(css).toMatch(/@layer components \{\s*\.lp-btn \{/);
    expect(views).toMatch(/"3": "@xl:grid-cols-2 @3xl:grid-cols-3"/);
    expect(css).toMatch(/\.lp-btn \{\s*min-height: 44px/);
    expect(css).toMatch(/overflow-x: clip/);
  });
});
