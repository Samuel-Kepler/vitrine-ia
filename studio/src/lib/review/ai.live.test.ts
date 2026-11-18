// Diagnóstico manual: revisão com IA nos três modos, provedor Groq do .env.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/review/ai.live.test.ts
import { expect, it } from "vitest";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { starterDraft } from "@/lib/draft/starter";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { REVIEW_MODES } from "./ai-input";
import { aiReview } from "./ai";

it.skipIf(!process.env.RUN_LIVE)("revisão ao vivo", { timeout: 180_000 }, async () => {
  const draft = starterDraft();
  const s = inferFromDraft(draft);
  const state = { draft, brief: "cafeteria no centro", messages: null, arch: expandArch(s.arch), db: expandDb(s.db) };
  for (const mode of REVIEW_MODES) {
    const r = await aiReview(mode, state, { kind: "groq" });
    console.log(`[${mode}] ${r.provider}/${r.modelId} fallback=${r.fallback} nota=${r.score} ${r.error ?? ""}\n  ${r.summary}\n` + r.issues.map((i) => `  - [${i.source}/${i.severity}] ${i.title}${i.targetId ? " (clicável)" : ""}`).join("\n"));
    expect(r.fallback, r.error).toBe(false);
  }
});
