import { describe, expect, it } from "vitest";
import { PANEL_MAX, PANEL_MIN, clampWidth, readWidth, writeWidth, type WidthStore } from "./panel-width";

function memStore(init: Record<string, string> = {}): WidthStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("clampWidth", () => {
  it("keeps values inside the range and rounds them", () => {
    expect(clampWidth(300, 200, 560)).toBe(300);
    expect(clampWidth(300.6, 200, 560)).toBe(301);
  });

  it("clamps to min and max", () => {
    expect(clampWidth(50, PANEL_MIN, PANEL_MAX)).toBe(200);
    expect(clampWidth(9999, PANEL_MIN, PANEL_MAX)).toBe(560);
    expect(clampWidth(-10)).toBe(PANEL_MIN);
  });

  it("treats non-finite input as the minimum", () => {
    expect(clampWidth(Number.NaN)).toBe(PANEL_MIN);
    expect(clampWidth(Number.POSITIVE_INFINITY)).toBe(PANEL_MIN);
  });
});

describe("readWidth", () => {
  it("returns the default (clamped) when nothing is stored", () => {
    expect(readWidth("studio.left", 288, memStore())).toBe(288);
    expect(readWidth("studio.left", 100, memStore())).toBe(PANEL_MIN);
  });

  it("reads a stored width and clamps it", () => {
    expect(readWidth("studio.left", 288, memStore({ "studio.left": "400" }))).toBe(400);
    expect(readWidth("studio.left", 288, memStore({ "studio.left": "9000" }))).toBe(PANEL_MAX);
  });

  it("falls back to the default for garbage values", () => {
    expect(readWidth("studio.right", 336, memStore({ "studio.right": "abc" }))).toBe(336);
  });

  it("falls back to the default when storage throws or is missing", () => {
    const throwing: WidthStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(readWidth("studio.left", 288, throwing)).toBe(288);
    expect(readWidth("studio.left", 288, null)).toBe(288);
  });
});

describe("writeWidth", () => {
  it("stores the clamped width under the key", () => {
    const s = memStore();
    writeWidth("studio.right", 9999, s);
    expect(s.data["studio.right"]).toBe(String(PANEL_MAX));
    writeWidth("studio.right", 240, s);
    expect(s.data["studio.right"]).toBe("240");
  });

  it("round-trips through readWidth", () => {
    const s = memStore();
    writeWidth("studio.left", 352, s);
    expect(readWidth("studio.left", 288, s)).toBe(352);
  });

  it("ignores storage errors", () => {
    const full: WidthStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => writeWidth("studio.left", 300, full)).not.toThrow();
    expect(() => writeWidth("studio.left", 300, null)).not.toThrow();
  });
});
