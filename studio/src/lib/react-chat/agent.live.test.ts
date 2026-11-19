// Diagnóstico manual: chat de código com o Groq do .env.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/react-chat/agent.live.test.ts
import { expect, it } from "vitest";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { starterDraft } from "@/lib/draft/starter";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { reactProject } from "@/lib/export/react";
import { runReactChat, syntaxError } from "./agent";

it.skipIf(!process.env.RUN_LIVE)("chat de código ao vivo", { timeout: 180_000 }, async () => {
  const pages = [{ name: "Início", file: "index.html", messages: compileResponse(draftToExpress(starterDraft())).messages }];
  const files = Object.fromEntries(reactProject(pages).map((f) => [f.path.replace(/^react/, ""), f.content]));
  const r = await runReactChat({ files, message: "Adicione uma seção de perguntas frequentes (com 2 perguntas e respostas em marcadores) logo antes do rodapé da página Início, usando os componentes Section e Heading.", settings: { kind: "groq" } });
  console.log(`${r.provider}/${r.modelId} passos=${r.steps} erro=${r.error ?? "-"}\nresposta: ${r.reply}\nalterados: ${Object.keys(r.changed).join(", ")}`);
  for (const [p, c] of Object.entries(r.changed)) console.log(`--- ${p}\n${c.slice(0, 2500)}`);
  expect(r.error).toBeUndefined();
  expect(Object.keys(r.changed).length).toBeGreaterThan(0);
  for (const [p, c] of Object.entries(r.changed)) expect(syntaxError(p, c), p).toBeNull();
});
