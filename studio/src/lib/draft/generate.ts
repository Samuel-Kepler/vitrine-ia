// "Gerar com IA" no servidor. Mock ou erro -> modelo por palavras-chave.
import { generateText, Output } from "ai";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import type { DraftNode } from "./tree";
import { GeneratedPageSchema, generatePrompt, generateSystem, templateFromPrompt, toDraft, type GeneratedPage } from "./generate-shared";

export interface GenerateResult {
  draft: DraftNode[];
  notes: string[];
  provider: string;
  modelId: string;
  /** true quando veio do modelo por palavras-chave porque a IA falhou. */
  fallback: boolean;
  error?: string;
}

const TEMPLATE_NOTE = "Modelo automático por palavras-chave: troque os textos entre colchetes pelos dados do seu negócio.";

export async function generatePage(input: { prompt: string; brief?: string; settings?: ProviderSettings }): Promise<GenerateResult> {
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const template = (error?: string): GenerateResult => ({ ...base, draft: templateFromPrompt(input.prompt), notes: [TEMPLATE_NOTE], fallback: !!error, error });
  if (resolved.kind === "mock") return template();
  try {
    const res = await generateText({
      model: resolved.model,
      system: generateSystem(),
      prompt: generatePrompt(input.prompt, input.brief),
      output: Output.object({ schema: GeneratedPageSchema }),
      temperature: 0.4,
      maxOutputTokens: 5000,
      maxRetries: 4,
      providerOptions: resolved.providerOptions as never,
    });
    const g = res.output as GeneratedPage;
    const draft = toDraft(g);
    if (!draft.length) return template("a IA devolveu uma página vazia");
    return { ...base, draft, notes: g.notes, fallback: false };
  } catch (err) {
    return template(friendlyAIError(err, resolved.kind, resolved.baseURL));
  }
}
