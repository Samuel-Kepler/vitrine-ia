// Tamanhos de tela do preview da landing (como o modo dispositivo do navegador).
export type DeviceGroup = "Celular" | "Tablet" | "Desktop";

export interface Device {
  id: string;
  label: string;
  group: DeviceGroup;
  width: number;
  height: number;
}

export const DEVICES: Device[] = [
  { id: "galaxy-s24", label: "Galaxy S24", group: "Celular", width: 360, height: 780 },
  { id: "iphone-se", label: "iPhone SE", group: "Celular", width: 375, height: 667 },
  { id: "iphone-15", label: "iPhone 15", group: "Celular", width: 393, height: 852 },
  { id: "pixel-8", label: "Pixel 8", group: "Celular", width: 412, height: 915 },
  { id: "iphone-15-pro-max", label: "iPhone 15 Pro Max", group: "Celular", width: 430, height: 932 },
  { id: "ipad-mini", label: "iPad mini", group: "Tablet", width: 768, height: 1024 },
  { id: "ipad-air", label: "iPad Air", group: "Tablet", width: 820, height: 1180 },
  { id: "galaxy-tab", label: "Galaxy Tab S9", group: "Tablet", width: 800, height: 1280 },
  { id: "ipad-pro", label: "iPad Pro 12.9", group: "Tablet", width: 1024, height: 1366 },
  { id: "laptop", label: "Notebook", group: "Desktop", width: 1280, height: 800 },
  { id: "macbook-air", label: "MacBook Air", group: "Desktop", width: 1440, height: 900 },
  { id: "full-hd", label: "Full HD", group: "Desktop", width: 1920, height: 1080 },
];

/** Atalhos da barra: um aparelho típico de cada grupo. */
export const QUICK: Record<DeviceGroup, string> = { Celular: "iphone-15", Tablet: "ipad-air", Desktop: "laptop" };

export const FIT = "fit";
export const CUSTOM = "custom";
export const MIN_WIDTH = 280;
export const MAX_WIDTH = 2560;

export interface ViewportState {
  /** id de DEVICES, FIT (ocupa a área) ou CUSTOM (largura livre). */
  device: string;
  customWidth: number;
  rotated: boolean;
}

export const DEFAULT_VIEWPORT: ViewportState = { device: FIT, customWidth: 1024, rotated: false };

export const clampWidth = (w: number) => Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number.isFinite(w) ? w : MIN_WIDTH)));

/** Tamanho efetivo: null = ocupa a área (sem moldura). height null = altura livre. */
export function resolveViewport(v: ViewportState): { width: number; height: number | null; label: string } | null {
  if (v.device === FIT) return null;
  if (v.device === CUSTOM) return { width: clampWidth(v.customWidth), height: null, label: "Personalizado" };
  const d = DEVICES.find((x) => x.id === v.device);
  if (!d) return null;
  const [width, height] = v.rotated ? [d.height, d.width] : [d.width, d.height];
  return { width, height, label: d.label };
}

/** Escala para a moldura caber na área disponível (nunca aumenta). */
export function fitScale(size: { width: number; height: number | null }, area: { width: number; height: number }): number {
  const sw = area.width / size.width;
  const sh = size.height ? area.height / size.height : Infinity;
  return Math.max(0.1, Math.min(1, sw, sh));
}

export function groupOf(v: ViewportState): DeviceGroup | null {
  return DEVICES.find((d) => d.id === v.device)?.group ?? null;
}
