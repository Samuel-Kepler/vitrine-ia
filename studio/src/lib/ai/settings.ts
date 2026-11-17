// Tipos compartilhados entre a tela e o servidor (sem dependências de Node).
import { z } from "zod";

export const PROVIDER_KINDS = ["mock", "groq", "google", "anthropic", "ollama", "openai-compatible"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export const PROVIDER_LABELS: Record<ProviderKind, string> = {
  mock: "Mock (offline)",
  groq: "Groq",
  google: "Google Gemini",
  anthropic: "Anthropic Claude",
  ollama: "Ollama (local)",
  "openai-compatible": "Compatível com OpenAI (LM Studio, llama.cpp, OpenRouter…)",
};

export const ProviderSettingsSchema = z.object({
  kind: z.enum(PROVIDER_KINDS).optional(),
  model: z.string().max(200).optional(),
  baseURL: z.string().max(500).optional(),
  apiKey: z.string().max(500).optional(),
});

export type ProviderSettings = z.infer<typeof ProviderSettingsSchema>;
