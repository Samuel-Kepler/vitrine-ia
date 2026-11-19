/**
 * Regras de URL seguras, compartilhadas entre o catálogo A2UI (validação da
 * saída da IA, no servidor) e o export HTML (sanitização, no navegador).
 * Sem dependência de DOM.
 */

const LINK_SCHEMES = new Set(["http", "https", "mailto", "tel"]);
const MEDIA_SCHEMES = new Set(["http", "https"]);
/** Imagens raster embutidas são ok; SVG em data: pode carregar script. */
const SAFE_DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]*$/i;

/** Esquema da URL como o navegador enxerga (ignora espaços e controles). */
function schemeOf(url: string): string | null {
  // eslint-disable-next-line no-control-regex
  const clean = url.replace(/[\u0000- \u007f]/g, "").toLowerCase();
  const m = /^([a-z][a-z0-9+.-]*):/.exec(clean);
  return m ? m[1] : null; // null = relativa (#ancora, /caminho, ./x)
}

/** Links: http(s), mailto, tel ou relativos. */
export function isSafeLinkUrl(url: string): boolean {
  const s = schemeOf(url);
  return s === null || LINK_SCHEMES.has(s);
}

/** Imagens: http(s), relativas ou data:image raster em base64. */
export function isSafeMediaUrl(url: string): boolean {
  const s = schemeOf(url);
  if (s === null) return true;
  if (s === "data") return SAFE_DATA_IMAGE.test(url.trim());
  return MEDIA_SCHEMES.has(s);
}

export const UNSAFE_MEDIA_URL_MESSAGE =
  "Unsafe image URL: use an https:// URL (or omit the field if unknown). javascript:, data: (except base64 png/jpeg/gif/webp/avif), vbscript: and file: are not allowed.";
