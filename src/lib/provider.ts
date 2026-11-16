// Ponto único de escolha do modelo.
//
// A aplicação inteira fala com a interface `LanguageModel` do AI SDK.
// Trocar de provedor (Anthropic, Gemini, Groq, OpenRouter) é só mudar
// variáveis de ambiente — nenhum outro arquivo precisa saber qual é.
//
//   AI_PROVIDER = anthropic | google | groq | openrouter | mock
//   AI_MODEL    = (opcional) sobrescreve o modelo padrão do provedor
//
// Sem AI_PROVIDER, usamos o primeiro provedor com chave configurada,
// e caímos no modelo mock se não houver nenhuma.
import type { LanguageModel } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MockLanguageModel } from "./mock-model";
import { createDebugFetch, isAIDebug } from "./debug-fetch";

export const PROVIDERS = ["anthropic", "google", "groq", "openrouter"] as const;
export type ProviderId = (typeof PROVIDERS)[number] | "mock";

// Variável de ambiente lida por cada pacote @ai-sdk/* por padrão.
export const API_KEY_ENV: Record<Exclude<ProviderId, "mock">, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

// Modelos padrão: rápidos, com bom suporte a tool calling.
// Free tiers mudam com frequência — sobrescreva com AI_MODEL quando precisar.
export const DEFAULT_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-haiku-5-5",
  google: "gemini-flash-latest",
  groq: "openai/gpt-oss-120b",
  // Modelos ":free" do OpenRouter entram e saem do catálogo.
  // Lista atual: curl -s https://openrouter.ai/api/v1/models | jq '.data[].id' | grep ':free'
  openrouter: "nvidia/nemotron-3-ultra-550b-a55b:free",
  mock: "mock-uigen",
};

export interface ModelConfig {
  provider: ProviderId;
  modelId: string;
  model: LanguageModel;
}

export function resolveProvider(
  env: Record<string, string | undefined> = process.env
): ProviderId {
  const requested = env.AI_PROVIDER?.trim().toLowerCase();

  if (requested) {
    if (requested === "mock") return "mock";
    if (!(PROVIDERS as readonly string[]).includes(requested)) {
      throw new Error(
        `AI_PROVIDER="${requested}" não é suportado. Use: ${PROVIDERS.join(", ")} ou mock.`
      );
    }
    const provider = requested as Exclude<ProviderId, "mock">;
    if (!env[API_KEY_ENV[provider]]?.trim()) {
      throw new Error(
        `AI_PROVIDER=${provider}, mas ${API_KEY_ENV[provider]} não está definida no .env.`
      );
    }
    return provider;
  }

  return PROVIDERS.find((p) => Boolean(env[API_KEY_ENV[p]]?.trim())) ?? "mock";
}

function buildModel(provider: ProviderId, modelId: string): LanguageModel {
  // AI_DEBUG=1 troca o fetch do provedor por um que loga cada requisição HTTP.
  const fetch = isAIDebug() && provider !== "mock" ? createDebugFetch(provider) : undefined;
  switch (provider) {
    case "anthropic":
      return createAnthropic({ fetch })(modelId);
    case "google":
      return createGoogle({ fetch })(modelId);
    case "groq":
      return createGroq({ fetch })(modelId);
    case "openrouter":
      return createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY, fetch })(modelId);
    case "mock":
      return new MockLanguageModel(modelId);
  }
}

export function getModelConfig(): ModelConfig {
  const provider = resolveProvider();
  const modelId = process.env.AI_MODEL?.trim() || DEFAULT_MODELS[provider];
  return { provider, modelId, model: buildModel(provider, modelId) };
}

// Só o "rótulo" do provedor ativo, para o badge da UI (não cria o modelo).
export interface ActiveModelInfo {
  provider: ProviderId;
  modelId: string;
  error?: string;
}

export function getActiveModelInfo(
  env: Record<string, string | undefined> = process.env
): ActiveModelInfo {
  try {
    const provider = resolveProvider(env);
    return { provider, modelId: env.AI_MODEL?.trim() || DEFAULT_MODELS[provider] };
  } catch (error) {
    return {
      provider: (env.AI_PROVIDER?.trim().toLowerCase() || "mock") as ProviderId,
      modelId: "não configurado",
      error: (error as Error).message,
    };
  }
}
