// Diagnóstico manual: Reimaginar -> revisar -> melhorar com a revisão -> revisar, com o Groq do .env.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/reimagine/improve.live.test.ts
import { expect, it } from "vitest";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { starterDraft } from "@/lib/draft/starter";
import { reimagine } from "./reimagine";
import { aiReview } from "@/lib/review/ai";
import { feedbackFrom } from "@/components/review/AiReviewPanel";

it.skipIf(!process.env.RUN_LIVE)("ciclo revisar -> melhorar ao vivo", { timeout: 400_000 }, async () => {
  const settings = { kind: "groq" as const };
  const draft = starterDraft();
  const brief = "cafeteria de bairro no centro, grãos especiais e torra própria";
  const state = (messages: unknown[]) => ({ draft, brief, messages, arch: { nodes: [], edges: [] }, db: { tables: [], relations: [] } });
  const first = await reimagine({ draft, brief, settings });
  console.log(`1) reimaginar: fallback=${first.fallback} ${first.error ?? ""}`);
  const r1 = await aiReview("landing", state(first.messages), settings);
  console.log(`2) revisão: nota ${r1.score} (fallback=${r1.fallback}) · ${r1.issues.length} pontos\n   ${feedbackFrom(r1).join("\n   ")}`);
  const second = await reimagine({ draft, brief, settings, previous: first.express, feedback: feedbackFrom(r1) });
  console.log(`3) melhorar: fallback=${second.fallback} ${second.error ?? ""} · fatos novos: ${second.facts.join("; ") || "-"}`);
  const r2 = await aiReview("landing", state(second.messages), settings);
  console.log(`4) revisão: nota ${r2.score} (antes ${r1.score})\n   ${r2.summary}`);
  expect(first.fallback, first.error).toBe(false);
  expect(second.fallback, second.error).toBe(false);
});
