// "Gerar com IA" no servidor. Mock ou erro -> modelo por palavras-chave.
import { generateText, Output } from "ai";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { plainText } from "@/lib/ai/plain-text";
import type { DraftNode } from "./tree";
import { GeneratedPageSchema, GeneratedSiteSchema, generatePrompt, generateSiteSystem, generateSystem, templateFromPrompt, templateSite, toDraft, toSite, type GeneratedPage, type GeneratedSite, type SiteDraft } from "./generate-shared";

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
    return { ...base, draft, notes: g.notes.map(plainText), fallback: false };
  } catch (err) {
    return template(friendlyAIError(err, resolved.kind, resolved.baseURL));
  }
}

export interface GenerateSiteResult {
  site: SiteDraft;
  provider: string;
  modelId: string;
  fallback: boolean;
  error?: string;
}

/** Site inteiro: páginas + menu e rodapé compartilhados. Mock ou erro -> modelo por palavras-chave. */
export async function generateSite(input: { prompt: string; brief?: string; settings?: ProviderSettings }): Promise<GenerateSiteResult> {
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const template = (error?: string): GenerateSiteResult => ({ ...base, site: templateSite(input.prompt), fallback: !!error, error });
  if (resolved.kind === "mock") return template();
  // Site é uma resposta grande: uma segunda tentativa costuma resolver um JSON fora do schema.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) try {
    const res = await generateText({
      model: resolved.model,
      system: generateSiteSystem(),
      prompt: generatePrompt(input.prompt, input.brief),
      output: Output.object({ schema: GeneratedSiteSchema }),
      temperature: 0.4,
      maxOutputTokens: 9000,
      maxRetries: 4,
      providerOptions: resolved.providerOptions as never,
    });
    const site = toSite(res.output as GeneratedSite);
    if (site.pages.length < 2) return template("a IA devolveu menos de duas páginas");
    return { ...base, site, fallback: false };
  } catch (err) {
    lastError = err;
  }
  return template(friendlyAIError(lastError, resolved.kind, resolved.baseURL));
}
