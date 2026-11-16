// Contrato com a Aula 1: as issues que o ciclo abre vêm de
// reviewToIssues(DesignReview). Este teste tranca o formato que o
// workflow review-to-issues depende (labels, marcador de dedup, gh create).
import { describe, it, expect } from "vitest";
import { reviewToIssues, DesignReview } from "@/lib/review/schema";

const REVIEW = {
  score: 62,
  summary: "Landing funcional, mas com problemas de interação e contraste.",
  issues: [
    {
      id: "demo-site-cta-no-hover",
      title: "Adicionar hover state no CTA",
      file: "/demo-site/styles.css",
      severity: "medium",
      rule: "interaction-states",
      suggestion: "Adicionar :hover com escurecimento da cor do CTA.",
    },
    {
      id: "demo-site-subtitle-contrast",
      title: "Corrigir contraste do subtítulo",
      file: "/demo-site/styles.css",
      severity: "high",
      rule: "color",
      suggestion: "Escurecer .hero-subtitle para razão de contraste >= 4.5:1.",
    },
  ],
} satisfies DesignReview;

describe("reviewToIssues (contrato Aula 1 ↔ Aula 2)", () => {
  const drafts = reviewToIssues(REVIEW);

  it("uma issue por problema do review", () => {
    expect(drafts).toHaveLength(2);
    expect(drafts[0].title).toBe("Adicionar hover state no CTA");
  });

  it("labels: design-review + severity:<x>, prontas para `gh issue create`", () => {
    expect(drafts[0].labels).toEqual(["design-review", "severity:medium"]);
    expect(drafts[1].labels).toEqual(["design-review", "severity:high"]);
  });

  it("corpo carrega marcador estável de id (dedup do workflow)", () => {
    expect(drafts[0].body).toContain("<!-- design-review-id: demo-site-cta-no-hover -->");
    expect(drafts[0].body).toContain("`interaction-states`");
  });

  it("o schema zod rejeita review fora do formato", () => {
    expect(() => DesignReview.parse({ score: 120, summary: "x", issues: [] })).toThrow();
  });
});
