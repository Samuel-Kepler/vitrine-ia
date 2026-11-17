// Registro de provedores. Um único lugar decide qual modelo atende a
// requisição: configuração da tela (por requisição) > .env > mock.
import type { LanguageModel } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOllama } from "ollama-ai-provider-v2";
import { MockLanguageModel } from "./mock-model";
import { PROVIDER_KINDS, type ProviderKind, type ProviderSettings } from "./settings";

export const DEFAULT_MODELS: Record<ProviderKind, string> = {
  mock: "mock-a2ui",
  groq: "openai/gpt-oss-120b",
  google: "gemini-flash-latest",
  anthropic: "claude-haiku-5-5",
  ollama: "qwen2.5-coder:7b",
  "openai-compatible": "local-model",
};

const KEY_ENV: Partial<Record<ProviderKind, string>> = {
  groq: "GROQ_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
};

export const LOCAL_KINDS: ProviderKind[] = ["ollama", "openai-compatible"];

export interface ResolvedModel {
  model: LanguageModel;
  kind: ProviderKind;
  modelId: string;
  baseURL?: string;
  /** Opções extras por chamada (ex.: num_ctx do Ollama). */
  providerOptions?: Record<string, Record<string, unknown>>;
}

export class ProviderConfigError extends Error {}

function envKey(kind: ProviderKind): string | undefined {
  const name = KEY_ENV[kind];
  const v = name ? process.env[name] : undefined;
  return v && v.trim() ? v.trim() : undefined;
}

export function serverDefaultKind(): ProviderKind {
  const fromEnv = process.env.AI_PROVIDER?.trim() as ProviderKind | undefined;
  if (fromEnv && PROVIDER_KINDS.includes(fromEnv)) return fromEnv;
  // Só provedores de nuvem são detectados sozinhos; local exige escolha explícita.
  for (const k of ["anthropic", "google", "groq"] as ProviderKind[]) if (envKey(k)) return k;
  return "mock";
}

export function serverStatus() {
  const kind = serverDefaultKind();
  return {
    defaultKind: kind,
    defaultModel: (process.env.AI_PROVIDER?.trim() === kind && process.env.AI_MODEL?.trim()) || DEFAULT_MODELS[kind],
    defaultModels: DEFAULT_MODELS,
    keys: Object.fromEntries(Object.keys(KEY_ENV).map((k) => [k, !!envKey(k as ProviderKind)])),
    baseURLs: {
      ollama: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
      "openai-compatible": process.env.OPENAI_COMPATIBLE_BASE_URL || "http://localhost:1234/v1",
    },
  };
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0", "host.docker.internal"]);

/** Bloqueia SSRF: baseURL vinda da tela só pode ser local ou de host liberado. */
export function assertAllowedBaseURL(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProviderConfigError(`URL inválida: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ProviderConfigError("A URL precisa começar com http:// ou https://");
  const allowed = (process.env.ALLOWED_REMOTE_HOSTS ?? "openrouter.ai,api.groq.com,api.openai.com,api.together.xyz")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  const host = url.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host) && !allowed.includes(host)) {
    throw new ProviderConfigError(
      `Host ${host} não está liberado. Use um servidor local ou adicione o host em ALLOWED_REMOTE_HOSTS no .env.`,
    );
  }
  return url.toString().replace(/\/$/, "");
}

export function resolveModel(settings: ProviderSettings = {}): ResolvedModel {
  const kind = settings.kind ?? serverDefaultKind();
  const sameAsEnv = !settings.kind || settings.kind === serverDefaultKind();
  const modelId =
    settings.model?.trim() || (sameAsEnv && process.env.AI_MODEL?.trim()) || DEFAULT_MODELS[kind];
  const apiKey = settings.apiKey?.trim() || envKey(kind);
  const status = serverStatus();

  switch (kind) {
    case "mock":
      return { kind, modelId, model: new MockLanguageModel(modelId) };
    case "groq":
    case "google":
    case "anthropic": {
      if (!apiKey) throw new ProviderConfigError(`Falta a chave do ${kind}: defina ${KEY_ENV[kind]} no .env ou informe na engrenagem.`);
      const model =
        kind === "groq"
          ? createGroq({ apiKey })(modelId)
          : kind === "google"
            ? createGoogleGenerativeAI({ apiKey })(modelId)
            : createAnthropic({ apiKey })(modelId);
      return { kind, modelId, model };
    }
    case "ollama": {
      const baseURL = assertAllowedBaseURL(settings.baseURL?.trim() || status.baseURLs.ollama);
      const ollama = createOllama({ baseURL });
      return {
        kind,
        modelId,
        baseURL,
        model: ollama(modelId),
        // O padrão do Ollama (4096) corta o prompt em silêncio.
        providerOptions: { ollama: { options: { num_ctx: 16384 } } },
      };
    }
    case "openai-compatible": {
      const baseURL = assertAllowedBaseURL(settings.baseURL?.trim() || status.baseURLs["openai-compatible"]);
      const provider = createOpenAICompatible({ name: "local", baseURL, apiKey, supportsStructuredOutputs: true });
      return { kind, modelId, baseURL, model: provider.chatModel(modelId) };
    }
    default: {
      const never: never = kind;
      throw new ProviderConfigError(`Provedor desconhecido: ${String(never)}`);
    }
  }
}

/** Lista modelos de um servidor local (para o seletor da tela). */
export async function listLocalModels(kind: ProviderKind, rawBaseURL?: string): Promise<string[]> {
  const status = serverStatus();
  if (kind === "ollama") {
    const base = assertAllowedBaseURL(rawBaseURL || status.baseURLs.ollama);
    const res = await fetch(`${base}/tags`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
    const json = (await res.json()) as { models?: { name: string }[] };
    return (json.models ?? []).map((m) => m.name);
  }
  if (kind === "openai-compatible") {
    const base = assertAllowedBaseURL(rawBaseURL || status.baseURLs["openai-compatible"]);
    const res = await fetch(`${base}/models`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
    const json = (await res.json()) as { data?: { id: string }[] };
    return (json.data ?? []).map((m) => m.id);
  }
  return [];
}
