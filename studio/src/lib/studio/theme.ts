/**
 * Tema do Studio: "claro" | "escuro" | "sistema" (padrão).
 *
 * O tema efetivo vai em `data-theme="dark"|"light"` no <html>. Os tokens de cor
 * (globals.css) mudam por esse atributo. O script de `themeInitScript` roda antes
 * da primeira pintura para não piscar.
 */

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "studio.theme";
export const DEFAULT_THEME_PREF: ThemePref = "system";
export const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePref(value: unknown): value is ThemePref {
  return value === "light" || value === "dark" || value === "system";
}

/** Tema efetivo a partir da preferência e da preferência de sistema. */
export function resolveTheme(pref: ThemePref, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/** Próxima preferência no ciclo Claro → Escuro → Sistema → Claro. */
export function nextThemePref(pref: ThemePref): ThemePref {
  if (pref === "light") return "dark";
  if (pref === "dark") return "system";
  return "light";
}

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Lê a preferência salva. Qualquer falha (sem storage, valor inválido) cai no padrão. */
export function readThemePref(storage: ThemeStorage | null | undefined): ThemePref {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePref(raw) ? raw : DEFAULT_THEME_PREF;
  } catch {
    return DEFAULT_THEME_PREF;
  }
}

/** Salva a preferência. Ignora falhas (modo privado, quota, storage bloqueado). */
export function writeThemePref(storage: ThemeStorage | null | undefined, pref: ThemePref): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* sem persistência: o tema vale só nesta página */
  }
}

/** Aplica o tema efetivo no elemento (normalmente document.documentElement). */
export function applyTheme(root: { setAttribute(name: string, value: string): void }, resolved: ResolvedTheme): void {
  root.setAttribute("data-theme", resolved);
}

/** Código JS (inline, sem módulos) que aplica o tema antes da pintura. Mesma lógica de readThemePref/resolveTheme. */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var dark=p==="dark"||(p!=="light"&&window.matchMedia(${JSON.stringify(SYSTEM_DARK_QUERY)}).matches);document.documentElement.setAttribute("data-theme",dark?"dark":"light");}catch(e){}})();`;
