// Servidor do "Desenhar no Bloco livre": imagem + descrição -> blocos.
import { generateText, Output } from "ai";
import { resolveVisionModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { GeneratedPageSchema, toDraft, type GeneratedPage } from "./generate-shared";
import { mergeHeadingOnly, sketchPrompt, sketchSystem, templateFromSketch } from "./sketch-shared";
import type { DraftNode } from "./tree";

export interface SketchResult {
  draft: DraftNode[];
  notes: string[];
  provider: string;
  modelId: string;
  /** true quando a IA não montou (mock ou erro): veio do modelo automático. */
  fallback: boolean;
  error?: string;
}

export async function runSketch(input: { image?: string; name?: string; description?: string; brief?: string; settings?: ProviderSettings }): Promise<SketchResult> {
  const resolved = resolveVisionModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const template = (error?: string): SketchResult => ({
    ...base,
    draft: templateFromSketch(input.name, input.description),
    notes: ["Montado pela descrição, sem ler o desenho. Ajuste os blocos ou tente de novo com um provedor que enxerga imagens."],
    fallback: true,
    error,
  });
  if (resolved.kind === "mock") return { ...template(), error: undefined };

  const text = sketchPrompt([input.name, input.description].filter(Boolean).join(": "), input.brief, !!input.image);
  // O modelo de visão às vezes devolve JSON fora do schema: uma segunda tentativa costuma resolver.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) try {
    const res = await generateText({
      model: resolved.model,
      system: sketchSystem(),
      messages: [
        {
          role: "user",
          content: input.image ? [{ type: "text", text }, { type: "file", data: input.image, mediaType: input.image.slice(5, input.image.indexOf(";")) }] : text,
        },
      ],
      output: Output.object({ schema: GeneratedPageSchema }),
      temperature: 0.3,
      maxOutputTokens: 6000,
      maxRetries: 3,
      providerOptions: resolved.providerOptions as never,
    });
    const g = res.output as GeneratedPage;
    const draft = mergeHeadingOnly(toDraft(g).filter((n) => n.type !== "navbar" && n.type !== "footer"));
    if (!draft.length) return template("a IA devolveu um bloco vazio");
    return { ...base, draft, notes: g.notes, fallback: false };
  } catch (err) {
    lastError = err;
  }
  return template(friendlyAIError(lastError, resolved.kind, resolved.baseURL));
}
