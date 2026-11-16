// Parte 2 do ciclo: contexto. A issue vira estrutura tipada antes do prompt.
import { describe, it, expect } from "vitest";
import { buildIssueContext } from "../issue-context";

const ISSUE = {
  number: 42,
  title: "Corrigir contraste do subtítulo",
  body: "**Arquivo:** `/demo-site/styles.css`\n**Regra:** `color`\n\n### Sugestão\nEscurecer a cor do subtítulo.",
  labels: ["agent:ready", "design-review", "severity:high"],
};

describe("buildIssueContext", () => {
  it("extrai severidade da label severity:<x>", () => {
    expect(buildIssueContext(ISSUE).severity).toBe("high");
  });

  it("extrai a dica de arquivo do corpo (formato do Design Review)", () => {
    expect(buildIssueContext(ISSUE).fileHint).toBe("/demo-site/styles.css");
  });

  it("deriva o nome da branch a partir do número da issue", () => {
    expect(buildIssueContext(ISSUE).branchName).toBe("agent/issue-42");
  });

  it("envolve título e corpo como dados não confiáveis", () => {
    const { renderedSection } = buildIssueContext(ISSUE);
    expect(renderedSection).toContain("<untrusted-issue-title>");
    expect(renderedSection).toContain("<untrusted-issue-body>");
  });

  it("tolera issue sem labels e sem dica de arquivo", () => {
    const ctx = buildIssueContext({ number: 7, title: "x", body: "y", labels: [] });
    expect(ctx.severity).toBeNull();
    expect(ctx.fileHint).toBeNull();
  });
});
