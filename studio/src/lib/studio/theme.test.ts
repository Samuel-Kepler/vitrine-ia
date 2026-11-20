import { describe, expect, it } from "vitest";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  nextThemePref,
  readThemePref,
  resolveTheme,
  themeInitScript,
  writeThemePref,
  type ThemeStorage,
} from "./theme";

function fakeStorage(init: Record<string, string> = {}): ThemeStorage & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe("resolveTheme", () => {
  it("usa a preferência explícita, ignorando o sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("segue o sistema quando a preferência é 'system'", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("nextThemePref", () => {
  it("cicla claro → escuro → sistema → claro", () => {
    expect(nextThemePref("light")).toBe("dark");
    expect(nextThemePref("dark")).toBe("system");
    expect(nextThemePref("system")).toBe("light");
  });
});

describe("readThemePref / writeThemePref", () => {
  it("usa a chave studio.theme", () => {
    expect(THEME_STORAGE_KEY).toBe("studio.theme");
  });

  it("padrão é 'system' sem storage ou sem valor salvo", () => {
    expect(readThemePref(undefined)).toBe("system");
    expect(readThemePref(null)).toBe("system");
    expect(readThemePref(fakeStorage())).toBe("system");
  });

  it("ignora valores inválidos salvos", () => {
    expect(readThemePref(fakeStorage({ "studio.theme": "blue" }))).toBe("system");
  });

  it("lê e grava a preferência válida", () => {
    const s = fakeStorage({ "studio.theme": "dark" });
    expect(readThemePref(s)).toBe("dark");
    writeThemePref(s, "light");
    expect(s.data["studio.theme"]).toBe("light");
    expect(readThemePref(s)).toBe("light");
  });

  it("não lança quando o storage falha", () => {
    const broken: ThemeStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(readThemePref(broken)).toBe("system");
    expect(() => writeThemePref(broken, "dark")).not.toThrow();
  });
});

describe("applyTheme", () => {
  it("define data-theme no elemento", () => {
    const attrs: Record<string, string> = {};
    applyTheme({ setAttribute: (n, v) => (attrs[n] = v) }, "dark");
    expect(attrs).toEqual({ "data-theme": "dark" });
  });
});

describe("themeInitScript", () => {
  it("é um script que lê a mesma chave e define data-theme", () => {
    expect(themeInitScript).toContain('"studio.theme"');
    expect(themeInitScript).toContain("data-theme");
    expect(themeInitScript).toContain("prefers-color-scheme: dark");
  });
});
