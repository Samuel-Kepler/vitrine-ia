// Diagnóstico manual: chama suggest() com o provedor do .env e mostra o erro bruto.
// Rodar: RUN_LIVE=1 npx vitest run src/lib/infer/suggest.live.test.ts (lê o .env)
import { it } from "vitest";
if (process.env.RUN_LIVE) process.loadEnvFile(".env");
import { generateText, Output } from "ai";
import { starterDraft } from "@/lib/draft/starter";
import { resolveModel } from "@/lib/ai/providers";
import { suggest, SuggestionSchema } from "@/lib/infer/suggest";

it.skipIf(!process.env.RUN_LIVE)("suggest ao vivo", { timeout: 120_000 }, async () => {
  const draft = starterDraft();
  const r = await suggest({ draft });
  console.log("fallback:", r.fallback, "| provider:", r.provider, r.modelId, "| error:", r.error);
  if (!r.fallback) return;
  const m = resolveModel();
  try {
    await generateText({ model: m.model, prompt: "Sugira backend para uma landing de café com formulário de contato.", output: Output.object({ schema: SuggestionSchema }), maxRetries: 0 });
  } catch (e) {
    const err = e as Record<string, unknown>;
    console.log("RAW:", err.name, String(err.message).slice(0, 1500));
    console.log("responseBody:", String(err.responseBody ?? (err.cause as Record<string, unknown>)?.responseBody ?? "").slice(0, 1500));
  }
});
