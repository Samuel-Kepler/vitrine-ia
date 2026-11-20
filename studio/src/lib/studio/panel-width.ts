/** Largura dos painéis laterais do Studio: funções puras (clamp e persistência). */

export const PANEL_MIN = 200;
export const PANEL_MAX = 560;
export const PANEL_STEP = 16;
export const PANEL_DEFAULT_LEFT = 288;
export const PANEL_DEFAULT_RIGHT = 336;

export interface WidthStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Limita a largura ao intervalo [min, max]; valores inválidos viram o mínimo. */
export function clampWidth(w: number, min: number = PANEL_MIN, max: number = PANEL_MAX): number {
  if (!Number.isFinite(w)) return min;
  return Math.min(max, Math.max(min, Math.round(w)));
}

function defaultStore(): WidthStore | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null; // acesso ao localStorage pode lançar (modo privado, bloqueado)
  }
}

/** Lê a largura salva em `key`; sem valor válido, devolve `def` (também limitado). */
export function readWidth(key: string, def: number, store: WidthStore | null = defaultStore(), min: number = PANEL_MIN, max: number = PANEL_MAX): number {
  try {
    const raw = store?.getItem(key);
    if (raw == null) return clampWidth(def, min, max);
    const n = Number(raw);
    return Number.isFinite(n) ? clampWidth(n, min, max) : clampWidth(def, min, max);
  } catch {
    return clampWidth(def, min, max);
  }
}

/** Salva a largura (limitada) em `key`. Falhas de armazenamento são ignoradas. */
export function writeWidth(key: string, w: number, store: WidthStore | null = defaultStore(), min: number = PANEL_MIN, max: number = PANEL_MAX): void {
  try {
    store?.setItem(key, String(clampWidth(w, min, max)));
  } catch {
    /* quota ou modo privado: a largura fica só na sessão */
  }
}
