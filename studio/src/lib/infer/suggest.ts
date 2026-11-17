// "Sugerir com IA": landing -> arquitetura + banco, por saída estruturada
// (JSON validado por zod). Modelo mock ou erro -> inferência determinística.
import { generateText, Output } from "ai";
import { z } from "zod/v4";
import type { DraftNode } from "@/lib/draft/tree";
import { draftOutline } from "@/lib/draft/to-express";
import { ARCH_KINDS, EDGE_KINDS } from "@/lib/arch/model";
import { COL_TYPES } from "@/lib/db/model";
import { resolveModel } from "@/lib/ai/providers";
import { friendlyAIError } from "@/lib/ai/errors";
import type { ProviderSettings } from "@/lib/ai/settings";
import { inferFromDraft, type Suggestion } from "./from-draft";

const ident = z.string().min(1).max(60);

export const SuggestionSchema = z.object({
  arch: z.object({
    nodes: z
      .array(
        z.object({
          key: ident.describe("short unique key, snake_case"),
          kind: z.enum(ARCH_KINDS),
          name: z.string().min(1).max(60).describe("display name in Portuguese"),
          routes: z.array(z.string().max(80)).max(30).nullable().describe('only for api/service, e.g. "POST /leads"; null otherwise'),
        }),
      )
      .min(1)
      .max(20),
    edges: z.array(z.object({ from: ident, to: ident, kind: z.enum(EDGE_KINDS) })).max(40),
  }),
  db: z.object({
    tables: z
      .array(
        z.object({
          name: ident.describe("snake_case plural"),
          columns: z
            .array(
              z.object({
                name: ident,
                type: z.enum(COL_TYPES),
                pk: z.boolean().nullable(),
                nullable: z.boolean().nullable(),
                unique: z.boolean().nullable(),
                default: z.string().max(40).nullable().describe('"now", "uuid", "autoincrement", a literal, or null'),
              }),
            )
            .min(1)
            .max(30),
        }),
      )
      .max(15),
    relations: z.array(z.object({ from: ident.describe("child table (gets the FK)"), to: ident.describe("parent table"), kind: z.enum(["n-1", "1-1", "n-n"]) })).max(30),
  }),
  notes: z.array(z.string().max(300)).max(8).describe("short explanations in Portuguese"),
});

const SYSTEM = `Você é um arquiteto de software pragmático. A partir de uma landing page, proponha o backend mínimo que ela precisa e o modelo de dados.
Regras:
- Arquitetura: um nó "web" (o site) e uma "api" com as rotas que a página usa. Adicione fila+worker só se houver trabalho assíncrono (ex.: e-mail após cadastro), "external" para serviços de terceiros (pagamento, e-mail), "auth" se houver login, "postgres" se houver dados.
- Ligações: from = quem chama/grava; to = quem é chamado. api->postgres "writes" ou "reads"; api->queue "event"; queue->worker "event"; chamadas "http".
- Banco: tabelas em snake_case plural, sempre com "id" uuid pk default "uuid" e created_at timestamp default "now" quando fizer sentido. Não crie colunas de chave estrangeira: use relations (from = tabela filha).
- Login: o bloco "auth" gera register/login/me dentro da API (não liste rotas /auth). Inclua a tabela "users" com "email" varchar unique e "password_hash" text. Rotas que exigem usuário logado terminam com " auth" (ex.: "POST /subscriptions auth").
- Seja enxuto: nada de microsserviços sem motivo.`;

// Provedores com saída estruturada estrita (Groq, OpenAI) exigem que toda
// propriedade esteja em "required"; por isso os opcionais são nullable e os
// nulls são removidos aqui.
type Raw = z.infer<typeof SuggestionSchema>;
function dropNulls<T extends object>(o: T) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null)) as { [K in keyof T]: Exclude<T[K], null> | undefined };
}
export function normalizeSuggestion(raw: Raw): Suggestion {
  return {
    arch: { nodes: raw.arch.nodes.map(dropNulls) as Suggestion["arch"]["nodes"], edges: raw.arch.edges },
    db: { tables: raw.db.tables.map((t) => ({ name: t.name, columns: t.columns.map(dropNulls) as Suggestion["db"]["tables"][number]["columns"] })), relations: raw.db.relations },
    notes: raw.notes,
  };
}

export interface SuggestResult {
  suggestion: Suggestion;
  provider: string;
  modelId: string;
  fallback: boolean;
  error?: string;
}

export async function suggest(input: { draft: DraftNode[]; brief?: string; settings?: ProviderSettings }): Promise<SuggestResult> {
  const resolved = resolveModel(input.settings);
  const base = { provider: resolved.kind, modelId: resolved.modelId };
  const fallback = (error?: string): SuggestResult => ({ ...base, suggestion: inferFromDraft(input.draft, input.brief), fallback: true, error });
  if (resolved.kind === "mock") return { ...fallback(), fallback: false };

  const prompt = [
    input.brief?.trim() ? `Briefing: ${input.brief.trim()}` : "",
    "Landing (de cima para baixo):",
    draftOutline(input.draft) || "(vazia)",
    "",
    "Uma sugestão automática para você melhorar (pode mudar tudo):",
    JSON.stringify(inferFromDraft(input.draft, input.brief)),
  ].join("\n");
  try {
    const res = await generateText({
      model: resolved.model,
      system: SYSTEM,
      prompt,
      output: Output.object({ schema: SuggestionSchema }),
      temperature: 0.3,
      maxOutputTokens: 6000,
      maxRetries: 4,
      providerOptions: resolved.providerOptions as never,
    });
    return { ...base, suggestion: normalizeSuggestion(res.output as Raw), fallback: false };
  } catch (err) {
    return fallback(friendlyAIError(err, resolved.kind, resolved.baseURL));
  }
}
