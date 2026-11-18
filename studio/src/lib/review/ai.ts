// Chamada ao modelo para a revisão com IA. Mock ou erro -> revisão só com regras.
import { generateText, Output } from "ai";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { AiReviewSchema, mergeReview, reviewPrompt, reviewSystem, ruleFindings, rulesOnly, type AiReviewRaw, type AiReviewResult, type ReviewMode, type ReviewState } from "./ai-input";

export async function aiReview(mode: ReviewMode, state: ReviewState, settings?: ProviderSettings): Promise<AiReviewResult> {
  const resolved = resolveModel(settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  if (resolved.kind === "mock") return rulesOnly(mode, state, base);
  try {
    const res = await generateText({
      model: resolved.model,
      system: reviewSystem(mode),
      prompt: reviewPrompt(mode, state, ruleFindings(mode, state)),
      output: Output.object({ schema: AiReviewSchema }),
      temperature: 0.2,
      maxOutputTokens: 2500,
      maxRetries: 4,
      providerOptions: resolved.providerOptions as never,
    });
    return mergeReview(mode, state, res.output as AiReviewRaw, base);
  } catch (err) {
    return rulesOnly(mode, state, { ...base, error: friendlyAIError(err, resolved.kind, resolved.baseURL) });
  }
}
