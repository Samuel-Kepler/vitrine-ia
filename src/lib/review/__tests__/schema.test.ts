import { describe, expect, test } from "vitest";
import { DesignReview, ReviewIssue, ReviewRule, reviewToIssues } from "../schema";

const issue = {
  id: "app-hero-no-hover",
  title: "CTA do hero sem hover",
  file: "/App.jsx",
  severity: "high" as const,
  rule: "interaction-states" as const,
  suggestion: "Adicione hover:bg-amber-600 ao botão.",
};

describe("DesignReview schema", () => {
  test("aceita um review válido", () => {
    const parsed = DesignReview.parse({ score: 82, summary: "Ok", issues: [issue] });
    expect(parsed.issues[0].rule).toBe("interaction-states");
  });

  test("aceita review sem issues", () => {
    expect(DesignReview.safeParse({ score: 100, summary: "Perfeito", issues: [] }).success).toBe(true);
  });

  test.each([-1, 101])("rejeita score fora de 0..100 (%s)", (score) => {
    expect(DesignReview.safeParse({ score, summary: "x", issues: [] }).success).toBe(false);
  });

  test("rejeita severity e rule desconhecidas", () => {
    expect(ReviewIssue.safeParse({ ...issue, severity: "critical" }).success).toBe(false);
    expect(ReviewIssue.safeParse({ ...issue, rule: "vibes" }).success).toBe(false);
  });

  test("rejeita issue sem campo obrigatório", () => {
    const { suggestion: _omit, ...partial } = issue;
    expect(ReviewIssue.safeParse(partial).success).toBe(false);
  });

  test("mantém as 10 regras do contrato", () => {
    expect(ReviewRule.options).toEqual([
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
  });
});

describe("reviewToIssues", () => {
  test("formata cada issue com title, body e labels", () => {
    const [draft] = reviewToIssues({ score: 70, summary: "x", issues: [issue] });
    expect(draft.title).toBe(issue.title);
    expect(draft.labels).toEqual(["design-review", "severity:high"]);
    expect(draft.body).toContain("`/App.jsx`");
    expect(draft.body).toContain("`interaction-states`");
    expect(draft.body).toContain(issue.suggestion);
    expect(draft.body).toContain("design-review-id: app-hero-no-hover");
  });

  test("é pura e devolve uma issue por item", () => {
    const review = {
      score: 50,
      summary: "x",
      issues: [issue, { ...issue, id: "b", severity: "low" as const }],
    };
    const copy = structuredClone(review);
    const drafts = reviewToIssues(review);
    expect(drafts).toHaveLength(2);
    expect(drafts[1].labels).toContain("severity:low");
    expect(review).toEqual(copy);
  });

  test("review sem issues vira lista vazia", () => {
    expect(reviewToIssues({ score: 100, summary: "ok", issues: [] })).toEqual([]);
  });
});
