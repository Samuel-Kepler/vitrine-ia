// AULA 2 — parte 2 do ciclo: CONTEXTO.
//
// Converte o payload da issue do GitHub em algo que o agente entende:
// um objetivo curto, dicas de arquivo (quando a issue veio do Design
// Review da Aula 1) e severidade das labels. Funções puras, com teste.

import { wrapUntrusted } from "./guardrails";

export interface IssueInput {
  number: number;
  title: string;
  body: string;
  labels: string[]; // ex.: ["design-review", "severity:high", "agent:ready"]
}

export interface IssueContext {
  number: number;
  goal: string; // usado como tarefa do agente
  severity: "low" | "medium" | "high" | null; // vem da label severity:<x>
  fileHint: string | null; // "**Arquivo:** `...`" nas issues do Design Review
  renderedSection: string; // bloco pronto para entrar no prompt
  branchName: string;
}

const FILE_RE = /\*\*Arquivo:\*\*\s*`([^`]+)`/;

export function buildIssueContext(issue: IssueInput, maxBodyChars = 4_000): IssueContext {
  const severityLabel = issue.labels.find((l) => l.startsWith("severity:"));
  const severity = (severityLabel?.split(":")[1] ?? null) as IssueContext["severity"];
  const fileHint = FILE_RE.exec(issue.body)?.[1] ?? null;

  const renderedSection = [
    `Issue #${issue.number}: ${wrapUntrusted("issue-title", issue.title, 200)}`,
    "",
    wrapUntrusted("issue-body", issue.body, maxBodyChars),
    severity ? `\nSeveridade (label confiável, aplicada por um humano): ${severity}` : "",
    fileHint ? `Arquivo indicado pelo review: \`${fileHint}\` (confira antes de editar)` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    number: issue.number,
    goal: issue.title,
    severity,
    fileHint,
    renderedSection,
    branchName: `agent/issue-${issue.number}`,
  };
}
