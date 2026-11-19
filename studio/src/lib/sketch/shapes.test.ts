import { describe, expect, it } from "vitest";
import { bbox, fromDrag, handleAt, hit, move, resize, tooSmall, topHit, type PenShape, type Shape, type TextShape } from "./shapes";

const rect = fromDrag("rect", 100, 100, 200, 160, "#111", 3);
const line = fromDrag("arrow", 0, 0, 100, 100, "#111", 3);
const pen: PenShape = { id: "p", kind: "pen", color: "#111", width: 3, points: [[10, 10], [20, 30], [40, 20]] };
const text: TextShape = { id: "t", kind: "text", color: "#111", width: 3, x: 300, y: 300, text: "Agende", size: 20 };

describe("formas do quadro", () => {
  it("caixa normalizada mesmo arrastando para trás", () => {
    expect(bbox(fromDrag("ellipse", 200, 200, 100, 150, "#111", 3))).toEqual({ x: 100, y: 150, w: 100, h: 50 });
    expect(bbox(pen)).toEqual({ x: 10, y: 10, w: 30, h: 20 });
  });

  it("clique acerta a forma certa (linha por distância, caixa por área, de cima para baixo)", () => {
    expect(hit(line, 50, 52)).toBe(true);
    expect(hit(line, 80, 20)).toBe(false);
    expect(hit(rect, 150, 130)).toBe(true);
    expect(hit(pen, 15, 20)).toBe(true);
    expect(hit(text, 310, 310)).toBe(true);
    const over = fromDrag("rect", 120, 110, 180, 150, "#111", 3);
    expect(topHit([rect, over], 150, 130)?.id).toBe(over.id);
  });

  it("mover desloca todos os pontos", () => {
    expect(bbox(move(rect, 10, -5))).toEqual({ x: 110, y: 95, w: 100, h: 60 });
    expect((move(pen, 5, 5) as PenShape).points[0]).toEqual([15, 15]);
  });

  it("alças: cantos na caixa, pontas na seta; redimensionar", () => {
    expect(handleAt(rect, 200, 160)).toBe("se");
    expect(handleAt(line, 100, 100)).toBe("p2");
    expect(bbox(resize(rect, "se", 300, 260))).toEqual({ x: 100, y: 100, w: 200, h: 160 });
    expect(bbox(resize(rect, "nw", 50, 50))).toEqual({ x: 50, y: 50, w: 150, h: 110 });
    // não inverte: tamanho mínimo
    expect(bbox(resize(rect, "se", 0, 0)).w).toBeGreaterThanOrEqual(8);
    expect(resize(line, "p1", 20, 30)).toMatchObject({ x1: 20, y1: 30, x2: 100, y2: 100 });
    // caneta escala proporcional à caixa; texto cresce a fonte
    expect(bbox(resize(pen, "se", 70, 50))).toEqual({ x: 10, y: 10, w: 60, h: 40 });
    expect((resize(text, "se", 400, 350) as TextShape).size).toBe(40);
  });

  it("clique sem arrastar não cria forma", () => {
    expect(tooSmall(fromDrag("rect", 10, 10, 12, 13, "#111", 3))).toBe(true);
    expect(tooSmall(rect)).toBe(false);
    expect(tooSmall(text as Shape)).toBe(false);
  });
});
