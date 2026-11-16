// Prints de antes/depois para o PR (AULA 2 — parte 5, checkpoint humano:
// o humano aprova OLHANDO as imagens).
//
//   npx tsx agent/screenshot.ts --out antes.png [--page agent/demo-site/index.html]
//
// Site estático → nada de build; abrir o arquivo direto no Chromium basta.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  console.error(`--${name} é obrigatório`);
  process.exit(2);
}

async function main() {
  const page = arg("page", "agent/demo-site/index.html");
  const out = arg("out");

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tab = await ctx.newPage();
  await tab.goto(pathToFileURL(path.resolve(page)).href);
  await tab.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(`[screenshot] ${out}`);
}

main().catch((error) => {
  console.error("[screenshot] falha:", error);
  process.exit(1);
});
