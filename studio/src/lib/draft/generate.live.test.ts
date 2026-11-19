// Diagnóstico manual: "Gerar com IA" com o Groq do .env.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/draft/generate.live.test.ts
import { expect, it } from "vitest";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { generatePage } from "./generate";
import type { DraftNode } from "./tree";

const show = (n: DraftNode, d = 0): string =>
  `${"  ".repeat(d)}- ${n.type} ${JSON.stringify(Object.fromEntries(Object.entries(n.props).filter(([, v]) => v)))}\n` + (n.children ?? []).map((c) => show(c, d + 1)).join("");

it.skipIf(!process.env.RUN_LIVE)("gerar página ao vivo", { timeout: 120_000 }, async () => {
  const r = await generatePage({ prompt: "padaria de bairro na Vila Mariana, pães de fermentação natural, com cardápio, depoimentos e formulário de encomenda", settings: { kind: "groq" } });
  console.log(`${r.provider}/${r.modelId} fallback=${r.fallback} ${r.error ?? ""}\n${r.draft.map((n) => show(n)).join("")}notas: ${r.notes.join(" | ")}`);
  expect(r.fallback, r.error).toBe(false);
});

it.skipIf(!process.env.RUN_LIVE)("gerar site ao vivo", { timeout: 180_000 }, async () => {
  const { generateSite } = await import("./generate");
  const r = await generateSite({ prompt: "estúdio de pilates em Pinheiros, aulas em grupo e particulares, planos mensais, equipe de instrutoras e agendamento de aula experimental", settings: { kind: "groq" } });
  console.log(`${r.provider}/${r.modelId} fallback=${r.fallback} ${r.error ?? ""}`);
  for (const p of r.site.pages) console.log(`## ${p.name}\n${p.tree.map((n) => show(n)).join("")}`);
  console.log(`notas: ${r.site.notes.join(" | ")}`);
  expect(r.fallback, r.error).toBe(false);
});
