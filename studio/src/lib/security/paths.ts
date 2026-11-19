/**
 * Regras de caminho para o projeto React editado pela IA e para os zips.
 *
 * O projeto baixado roda na máquina do usuário (`npm install`, `npm run dev`).
 * package.json (scripts como postinstall), vite.config.* e .npmrc executam
 * código Node ou mudam de onde vêm os pacotes, então a IA não pode tocá-los:
 * ela só edita código de navegador em /src e páginas .html na raiz.
 */

/** Caminho absoluto "limpo": sem .., sem //, sem \, sem segmento oculto (.env, .npmrc). */
export function isCleanAbsolutePath(path: string): boolean {
  if (!/^\/[\w./-]+$/.test(path)) return false;
  return path
    .slice(1)
    .split("/")
    .every((seg) => seg !== "" && !seg.startsWith("."));
}

/** Arquivos que a IA do chat React pode criar, alterar ou apagar. */
export function isAiEditablePath(path: string): boolean {
  if (!isCleanAbsolutePath(path)) return false;
  if (/^\/src\/.+\.(tsx|ts|jsx|js|css)$/.test(path)) return true;
  return /^\/[\w-]+\.html$/.test(path); // páginas na raiz (index.html, cardapio.html)
}

export const AI_PATH_ERROR =
  "Erro: só é permitido editar arquivos em /src (.tsx, .ts, .jsx, .js, .css) e páginas .html na raiz. " +
  "package.json, vite.config, tsconfig e arquivos ocultos não podem ser alterados.";

/**
 * Caminho relativo seguro para dentro de um zip (sem zip-slip): sem "..",
 * sem "/" inicial, sem "\" nem letra de unidade. Arquivos ocultos (.env.example,
 * .dockerignore) são permitidos aqui: fazem parte dos moldes gerados.
 */
export function isSafeZipPath(path: string): boolean {
  if (!/^[\w.@+-][\w./@+-]*$/.test(path)) return false;
  return path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}
