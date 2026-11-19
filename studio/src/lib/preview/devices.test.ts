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
    const views = readFileSync("src/lib/a2ui/views.tsx", "utf8");
    expect(views).not.toMatch(/[\s"`](sm|md|lg|xl):/);
    expect(views).toMatch(/@3xl:/);
    expect(readFileSync("src/app/globals.css", "utf8")).toMatch(/\.lp \{[^}]*container-type: inline-size/);
  });
});
