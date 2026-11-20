// Núcleo do botão "Reimaginar": rascunho -> modelo -> A2UI validado.
// Modelos fracos erram: o erro do compilador volta para o modelo (até 3
// tentativas) e, se ainda assim falhar, devolvemos a versão determinística.
import { generateText, type ModelMessage } from "ai";
import type { DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse, promptSnippet, type A2uiMessage } from "@/lib/a2ui/agent";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { plainText } from "@/lib/ai/plain-text";
import { systemPrompt, userPrompt } from "./prompt";
import { checkFacts, factWarnings } from "./fact-check";

export const MAX_ATTEMPTS = 3;

export interface ReimagineInput {
  draft: DraftNode[];
  brief?: string;
  palette?: string;
  theme?: string;
  motion?: string;
  previous?: string;
  feedback?: string[];
  settings?: ProviderSettings;
}

export interface ReimagineResult {
  ok: boolean;
  messages: A2uiMessage[];
  express: string;
  note: string;
  provider: string;
  modelId: string;
  attempts: number;
  /** true quando a página veio do compilador determinístico (sem IA). */
  fallback: boolean;
  warnings: string[];
  /** Números e nomes próprios na página que não estavam no rascunho/briefing (só aviso). */
  facts: string[];
  error?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

function fallbackResult(input: ReimagineInput, base: Omit<ReimagineResult, "messages" | "express" | "fallback" | "ok" | "note" | "facts">): ReimagineResult {
  const express = draftToExpress(input.draft, { palette: input.palette, theme: input.theme, motion: input.motion });
  const { messages } = compileResponse(express);
  return { ...base, ok: false, fallback: true, messages, express, facts: [], note: "Versão automática do rascunho (sem IA)." };
}

export async function reimagine(input: ReimagineInput): Promise<ReimagineResult> {
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId, attempts: 0, warnings: [] as string[] };
  const system = systemPrompt(promptSnippet());
  const messages: ModelMessage[] = [{ role: "user", content: userPrompt(input.draft, input) }];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    base.attempts = attempt;
    let text: string;
    try {
      const res = await generateText({
        model: resolved.model,
        system,
        messages,
        temperature: 0.5,
        maxOutputTokens: 8000,
        maxRetries: 4,
        providerOptions: resolved.providerOptions as never,
      });
      text = res.text;
      inputTokens += res.usage.inputTokens ?? 0;
      outputTokens += res.usage.outputTokens ?? 0;
    } catch (err) {
      const error = friendlyAIError(err, resolved.kind, resolved.baseURL);
      return { ...fallbackResult(input, base), error, usage: { inputTokens, outputTokens } };
    }
    try {
      const compiled = compileResponse(text);
      return {
        ...base,
        ok: true,
        fallback: false,
        messages: compiled.messages,
        express: compiled.express,
        facts: factWarnings(checkFacts(compiled.messages, input.draft, input.brief)),
        note: plainText(compiled.prose),
        usage: { inputTokens, outputTokens },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      base.warnings.push(`Tentativa ${attempt}: ${msg}`);
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `O compilador recusou: ${msg}\nCorrija e envie o bloco <a2ui> completo de novo.`,
      });
    }
  }
  return {
    ...fallbackResult(input, base),
    error: `A IA não gerou A2UI válido em ${MAX_ATTEMPTS} tentativas. Mostrando a versão automática do rascunho.`,
    usage: { inputTokens, outputTokens },
  };
}
