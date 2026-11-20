// Revisão com IA (nota + problemas) nos três modos. Este arquivo é puro (roda
// no cliente e no servidor): monta a entrada do modelo, o schema da resposta,
// a revisão só com regras (plano B) e a junção regras + IA.
import { z } from "zod/v4";
import { plainText } from "@/lib/ai/plain-text";
import { ARCH, EDGE_LABELS, authMode, type ArchGraph } from "@/lib/arch/model";
import { toDbml } from "@/lib/db/codegen";
import type { ErModel } from "@/lib/db/model";
import { draftOutline } from "@/lib/draft/to-express";
import type { DraftNode } from "@/lib/draft/tree";
import { a2uiTexts, checkFacts, factWarnings } from "@/lib/reimagine/fact-check";
import { reviewArch, reviewDb, type Finding, type Severity } from "./rules";

export const REVIEW_MODES = ["landing", "arch", "db"] as const;
export type ReviewMode = (typeof REVIEW_MODES)[number];

export const MODE_LABEL: Record<ReviewMode, string> = { landing: "Landing", arch: "Arquitetura", db: "Banco" };

export interface ReviewState {
  draft: DraftNode[];
  brief?: string;
  /** Mensagens A2UI do último Reimaginar (null se não houve). */
  messages?: unknown[] | null;
  arch: ArchGraph;
  db: ErModel;
}

// Groq/OpenAI estritos: toda propriedade em "required"; opcional = nullable.
export const AiReviewSchema = z.object({
  score: z.number().int().min(0).max(100).describe("0 = inutilizável, 100 = pronto para publicar"),
  summary: z.string().min(1).max(400).describe("1-2 frases em português"),
  issues: z
    .array(
      z.object({
        severity: z.enum(["error", "warning", "info"]),
        title: z.string().min(1).max(100).describe("problema, em português, curto"),
        suggestion: z.string().min(1).max(300).describe("o que mudar, concreto, em português"),
        target: z.string().max(80).nullable().describe("nome exato do bloco, tabela ou seção afetada; null se for geral"),
      }),
    )
    .max(6),
});
export type AiReviewRaw = z.infer<typeof AiReviewSchema>;

export interface ReviewIssue {
  severity: Severity;
  title: string;
  suggestion?: string;
  /** id do nó/tabela no canvas, quando a IA citou um nome que existe. */
  targetId?: string;
  target?: string;
  source: "regra" | "ia";
  code?: string;
}

export interface AiReviewResult {
  mode: ReviewMode;
  score: number;
  summary: string;
  issues: ReviewIssue[];
  provider: string;
  modelId: string;
  /** true quando a IA falhou e a revisão veio só das regras. */
  fallback: boolean;
  error?: string;
  /** Impressão digital da entrada: muda quando o canvas muda (revisão desatualizada). */
  inputKey: string;
}

// ---------------- regras por modo ----------------

export function landingFindings(s: Pick<ReviewState, "draft" | "brief" | "messages">): Finding[] {
  if (!s.messages?.length) return [{ code: "L1", severity: "info", message: "Sem Reimaginar: a revisão olha só o rascunho." }];
  return factWarnings(checkFacts(s.messages, s.draft, s.brief)).map((m) => ({ code: "L2", severity: "warning" as const, message: m }));
}

export function ruleFindings(mode: ReviewMode, s: ReviewState): Finding[] {
  if (mode === "arch") return reviewArch(s.arch, s.db);
  if (mode === "db") return reviewDb(s.db);
  return landingFindings(s);
}

/** Nota sem IA: começa em 100 e desconta por gravidade. */
export function ruleScore(findings: Finding[]): number {
  const cost = { error: 20, warning: 8, info: 2 } as const;
  return Math.max(0, 100 - findings.reduce((n, f) => n + cost[f.severity], 0));
}

/** Com erro de regra, a nota não passa de 69, por mais que a IA goste. */
export const ERROR_CAP = 69;

// ---------------- entrada do modelo ----------------

function archText(g: ArchGraph): string {
  const name = new Map(g.nodes.map((n) => [n.id, n.name]));
  const nodes = g.nodes.map((n) => {
    const extra = [n.props.routes ? `rotas: ${n.props.routes.split("\n").join("; ")}` : "", n.kind === "auth" ? `tipo: ${authMode(n)}` : "", n.kind === "postgres" ? `banco: ${n.props.database ?? "app"}` : ""].filter(Boolean);
    return `- ${n.name} (${ARCH[n.kind].label})${extra.length ? ` — ${extra.join(" · ")}` : ""}`;
  });
  const edges = g.edges.map((e) => `- ${name.get(e.source)} → ${name.get(e.target)} (${EDGE_LABELS[e.kind]})`);
  return ["Blocos:", ...nodes, "", "Ligações:", ...(edges.length ? edges : ["(nenhuma)"])].join("\n");
}

export function reviewInput(mode: ReviewMode, s: ReviewState): string {
  if (mode === "arch") return s.arch.nodes.length ? archText(s.arch) : "";
  if (mode === "db") return s.db.tables.length ? toDbml(s.db) : "";
  const parts = [s.brief?.trim() ? `Briefing: ${s.brief.trim()}` : "", "Rascunho (de cima para baixo):", draftOutline(s.draft) || "(vazio)"];
  if (s.messages?.length) parts.push("", "Textos da página gerada:", ...a2uiTexts(s.messages).map((t) => `- ${t}`));
  return parts.filter((p) => p !== "").join("\n");
}

/** Hash curto e estável (FNV-1a) da entrada, para saber se a revisão envelheceu. */
export function inputKey(mode: ReviewMode, s: ReviewState): string {
  const text = `${mode}\n${reviewInput(mode, s)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

const FOCUS: Record<ReviewMode, string> = {
  landing:
    "uma landing page de pequeno negócio. Avalie: clareza da proposta no topo, chamada para ação visível e repetida, ordem das seções, textos vagos ou longos, prova social, formulário com campos demais, e fatos que pareçam inventados (preços, horários, nomes, números) sem estarem no rascunho ou no briefing.",
  arch:
    "a arquitetura de backend de uma landing page. Avalie: ponto único de falha, segredos e autenticação, rotas que gravam sem validação, trabalho lento feito na requisição (deveria ir para fila), fila sem worker, cache sem motivo, excesso de serviços para o tamanho do projeto.",
  db:
    "o modelo de dados (DBML) de uma landing page. Avalie: chaves primárias, tipos (dinheiro em decimal, datas em timestamp), colunas que deveriam ser únicas ou obrigatórias, normalização, relações e ON DELETE, dados pessoais guardados sem necessidade, índices para as buscas óbvias.",
};

/** O que o Studio já gera sozinho: a IA não deve cobrar isso como problema. */
const ALREADY: Record<ReviewMode, string> = {
  landing: "",
  arch: "O código gerado JÁ faz: validação zod no corpo de toda rota que grava (400/409), segredos e URLs só via .env, JWT HS256 e senha com scrypt na auth própria, healthchecks e restart no docker-compose, worker consumindo a fila. Não aponte esses itens.",
  db: "O código gerado JÁ cria índice para toda chave estrangeira e NOT NULL/UNIQUE conforme o diagrama. Não aponte índice de FK.",
};

export function reviewSystem(mode: ReviewMode, year = new Date().getFullYear()): string {
  return `Você é um revisor sênior. Revise ${FOCUS[mode]}
Ano atual: ${year}. ${ALREADY[mode]}
Regras:
- Nota de 0 (inutilizável) a 100 (pronto). Seja justo: um projeto pequeno e correto merece nota alta.
- No máximo 6 problemas, do mais importante para o menos. Cada um com título curto e sugestão concreta.
- "target" é o nome EXATO de um bloco, tabela ou seção que aparece na entrada; null se o problema for geral.
- Os "problemas já apontados pelas regras" aparecem para o painel: NÃO os repita, mas considere-os na nota.
- Não invente partes que não estão na entrada. Escreva tudo em português do Brasil, em texto puro: sem markdown (nada de **negrito**, #, listas com traço) e sem emojis.
- Nas sugestões, NUNCA proponha fatos concretos que não estão na entrada (horários, preços, endereços, telefones, nomes, números, depoimentos): eles viram texto do site. Use marcadores, ex.: "informe o horário completo, como [dias e horários]".`;
}

export function reviewPrompt(mode: ReviewMode, s: ReviewState, findings: Finding[]): string {
  return [
    reviewInput(mode, s),
    "",
    "Problemas já apontados pelas regras:",
    ...(findings.length ? findings.map((f) => `- [${f.severity}] ${f.message}`) : ["(nenhum)"]),
  ].join("\n");
}

// ---------------- resultado ----------------

function fromRule(f: Finding): ReviewIssue {
  return { severity: f.severity, title: f.message, targetId: f.targetId, source: "regra", code: f.code };
}

/** Nomes que a IA pode citar -> ids clicáveis no canvas. */
export function targetIndex(mode: ReviewMode, s: ReviewState): Map<string, string> {
  const items = mode === "arch" ? s.arch.nodes.map((n) => [n.name, n.id]) : mode === "db" ? s.db.tables.map((t) => [t.name, t.id]) : [];
  return new Map(items.map(([k, v]) => [k.trim().toLowerCase(), v]));
}

export function rulesOnly(mode: ReviewMode, s: ReviewState, base: { provider: string; modelId: string; error?: string }): AiReviewResult {
  const findings = ruleFindings(mode, s);
  const n = findings.length;
  return {
    mode,
    score: ruleScore(findings),
    summary: n ? `Revisão automática (sem IA): ${n} ${n === 1 ? "ponto" : "pontos"} das regras.` : "Revisão automática (sem IA): as regras não apontaram nada.",
    issues: findings.map(fromRule),
    ...base,
    fallback: true,
    inputKey: inputKey(mode, s),
  };
}

export function mergeReview(mode: ReviewMode, s: ReviewState, raw: AiReviewRaw, base: { provider: string; modelId: string }): AiReviewResult {
  const findings = ruleFindings(mode, s);
  const targets = targetIndex(mode, s);
  const seen = new Set(findings.map((f) => f.message.toLowerCase()));
  const ai: ReviewIssue[] = raw.issues
    .filter((i) => !seen.has(plainText(i.title).toLowerCase()))
    .map((i) => ({
      severity: i.severity,
      title: plainText(i.title),
      suggestion: plainText(i.suggestion),
      target: i.target ?? undefined,
      targetId: i.target ? targets.get(i.target.trim().toLowerCase()) : undefined,
      source: "ia" as const,
    }));
  const hasError = findings.some((f) => f.severity === "error");
  return {
    mode,
    score: hasError ? Math.min(raw.score, ERROR_CAP) : raw.score,
    summary: plainText(raw.summary),
    issues: [...findings.map(fromRule), ...ai],
    ...base,
    fallback: false,
    inputKey: inputKey(mode, s),
  };
}
