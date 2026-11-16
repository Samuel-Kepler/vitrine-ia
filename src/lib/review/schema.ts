// Contrato do Design Review (structured output).
//
// ATENÇÃO: a Aula 2 (Loop Engineering) consome este arquivo para abrir
// issues no GitHub. Não mude nomes/formatos sem combinar antes.
import { z } from "zod";

export const ReviewRule = z.enum([
  "visual-hierarchy",
  "spacing",
  "color",
  "interaction-states",
  "depth",
  "buttons",
  "empty-loading-states",
  "layout",
  "accessibility",
  "content",
]);

export const ReviewIssue = z.object({
  id: z.string(), // slug estável, ex. "app-hero-no-hover"
  title: z.string(), // curto, vira título de issue no GitHub
  file: z.string(), // ex. "/App.jsx"
  severity: z.enum(["low", "medium", "high"]),
  rule: ReviewRule,
  suggestion: z.string(), // o que mudar, acionável
});

export const DesignReview = z.object({
  score: z.number().min(0).max(100),
  summary: z.string(),
  issues: z.array(ReviewIssue),
});

export type ReviewRule = z.infer<typeof ReviewRule>;
export type ReviewIssue = z.infer<typeof ReviewIssue>;
export type DesignReview = z.infer<typeof DesignReview>;
export type Severity = ReviewIssue["severity"];

export interface GitHubIssueDraft {
  title: string;
  body: string;
  labels: string[];
}

// Função pura: transforma o review em rascunhos de issue do GitHub.
// Usada pela Aula 2 (`review-to-issues`).
export function reviewToIssues(review: DesignReview): GitHubIssueDraft[] {
  return review.issues.map((issue) => ({
    title: issue.title,
    body: [
      `**Arquivo:** \`${issue.file}\``,
      `**Regra:** \`${issue.rule}\``,
      `**Severidade:** ${issue.severity}`,
      "",
      "### Sugestão",
      issue.suggestion,
      "",
      "---",
      `Score geral do review: ${review.score}/100`,
      `<!-- design-review-id: ${issue.id} -->`,
    ].join("\n"),
    labels: ["design-review", `severity:${issue.severity}`],
  }));
}
