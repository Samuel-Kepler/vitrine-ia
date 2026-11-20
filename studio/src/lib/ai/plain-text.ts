// Texto livre escrito pela IA (notas, resumos, problemas) -> texto puro para a UI.
// Tira marcas de markdown (negrito, código, títulos, listas) e marcadores de
// emoji no começo da linha. Não mexe em texto comum: "R$ 45", "5*3", "my_file_name"
// e "/team_members" continuam iguais.

// Emoji no começo da linha, sem ©, ® e ™ (são símbolos de texto, não bullets).
const EMOJI_BULLET = /^(?:(?![©®™])\p{Extended_Pictographic}[️‍⃣]*)+\s*/u;
const SYMBOL_BULLET = /^[•●◦▪▫■□◆◇‣⁃∙✓→➤➡]\s*/;
const HEADING = /^\s{0,3}#{1,6}\s+/;
const LIST_MARKER = /^\s*(?:[-*+]|\d{1,3}[.)])\s+/;

function stripLeading(line: string): string {
  let out = line.replace(HEADING, "");
  for (let i = 0; i < 4; i++) {
    const next = out.replace(LIST_MARKER, "").replace(EMOJI_BULLET, "").replace(SYMBOL_BULLET, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

function stripEmphasis(text: string): string {
  return text
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, "$1")
    .replace(/(^|[^\w])__(?=\S)([^_\n]*?\S)__(?!\w)/g, "$1$2")
    .replace(/(^|[^\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])/g, "$1$2")
    .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, "$1$2");
}

export function plainText(s: string): string {
  return s
    .split("\n")
    .map((line) => stripEmphasis(stripLeading(line)).replace(/ {2,}/g, " ").trim())
    .join("\n")
    .trim();
}
