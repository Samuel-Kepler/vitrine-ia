// Imagens enviadas do computador.
//
// O arquivo vira um data URL comprimido guardado no mapa `assets` do projeto.
// No rascunho fica só um endereço curto, https://asset.invalid/<id> (.invalid é
// reservado: nunca resolve na internet). Assim a IA do Reimaginar recebe uma
// linha, não centenas de KB, e o histórico/localStorage não duplicam a imagem.
// Na hora de mostrar ou exportar, resolveAssets troca o endereço pela imagem.

export const ASSET_PREFIX = "https://asset.invalid/";
const ASSET_RE = /https:\/\/asset\.invalid\/([a-z0-9_]+)/g;

export const assetUrl = (id: string) => `${ASSET_PREFIX}${id}`;
export const isAssetUrl = (s: string | undefined) => !!s && s.startsWith(ASSET_PREFIX);
export const assetIdOf = (s: string) => (isAssetUrl(s) ? s.slice(ASSET_PREFIX.length) : null);

/** Troca os endereços de imagem do usuário pelas imagens, em qualquer JSON (mensagens A2UI, rascunho…). */
export function resolveAssets<T>(value: T, assets: Record<string, string>): T {
  if (!assets || !Object.keys(assets).length) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.includes(ASSET_PREFIX) ? v.replace(ASSET_RE, (m, id: string) => assets[id] ?? m) : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/** Ids de imagem citados em qualquer JSON (para limpar as que ninguém usa). */
export function referencedAssets(value: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") for (const m of v.matchAll(ASSET_RE)) out.add(m[1]);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/avif": "avif" };

/** data:image/webp;base64,... -> bytes e extensão. */
export function decodeDataUrl(d: string): { bytes: Uint8Array; ext: string } | null {
  const m = /^data:(image\/[a-z]+);base64,([a-z0-9+/=\s]+)$/i.exec(d);
  if (!m || !EXT[m[1].toLowerCase()]) return null;
  const bin = atob(m[2].replace(/\s/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, ext: EXT[m[1].toLowerCase()] };
}

/**
 * Para baixar um projeto (zip): as imagens citadas nos arquivos de `root` viram
 * arquivos em `${root}public/images/<id>.<ext>` e o código passa a apontar para
 * `/images/<id>.<ext>` (pasta public do Vite). O código continua leve.
 */
export function exportAssetFiles(
  files: { path: string; content: string }[],
  assets: Record<string, string>,
  root = "",
): { path: string; content: string | Uint8Array }[] {
  const used = new Map<string, { bytes: Uint8Array; ext: string }>();
  for (const f of files) {
    if (!f.path.startsWith(root)) continue;
    for (const id of referencedAssets(f.content)) {
      const dec = assets[id] ? decodeDataUrl(assets[id]) : null;
      if (dec) used.set(id, dec);
    }
  }
  if (!used.size) return files;
  const rewritten = files.map((f) =>
    f.path.startsWith(root) ? { ...f, content: f.content.replace(ASSET_RE, (m, id: string) => (used.has(id) ? `/images/${id}.${used.get(id)!.ext}` : m)) } : f,
  );
  return [...rewritten, ...[...used].map(([id, { bytes, ext }]) => ({ path: `${root}public/images/${id}.${ext}`, content: bytes }))];
}

export function newAssetId(): string {
  const buf = new Uint8Array(6);
  globalThis.crypto.getRandomValues(buf);
  return "img_" + Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------- compressão (navegador) ----------------

export const MAX_IMAGE_SIDE = 1600;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
/** SVG fica de fora: pode carregar script. */
const ACCEPTED = /^image\/(png|jpe?g|webp|gif|avif)$/;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

/** Tamanho final mantendo a proporção, com o lado maior até `max`. */
export function fitSize(w: number, h: number, max = MAX_IMAGE_SIDE): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Lê, reduz e comprime a imagem (WebP; JPEG se o navegador não gerar WebP). */
export async function compressImage(file: File): Promise<string> {
  if (!ACCEPTED.test(file.type)) throw new Error("Use uma imagem PNG, JPEG, WebP, GIF ou AVIF (SVG não é aceito).");
  if (file.size > MAX_INPUT_BYTES) throw new Error("Imagem grande demais (máx. 20 MB).");
  const bmp = await createImageBitmap(file);
  const { w, h } = fitSize(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const webp = canvas.toDataURL("image/webp", 0.82);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}

/** Tamanho aproximado em KB de um data URL base64. */
export const dataUrlKb = (d: string) => Math.round((d.length * 3) / 4 / 1024);
