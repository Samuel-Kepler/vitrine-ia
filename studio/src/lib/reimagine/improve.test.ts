import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { draftToExpress } from "@/lib/draft/to-express";
import { userPrompt } from "./prompt";
import { feedbackFrom } from "@/components/review/AiReviewPanel";
import type { AiReviewResult } from "@/lib/review/ai-input";

const review = (issues: AiReviewResult["issues"]): AiReviewResult => ({ mode: "landing", score: 60, summary: "", issues, provider: "groq", modelId: "m", fallback: false, inputKey: "k" });

describe("melhorar com a revisão", () => {
  it("prompt parte da página atual e lista as correções", () => {
    const previous = draftToExpress(starterDraft(), { theme: "elegante" }).replace("café bom no centro", "Café de verdade");
    const p = userPrompt(starterDraft(), { previous, feedback: ["CTA fraco: use um verbo de ação", "  "] });
    expect(p).toContain("Correções pedidas pela revisão");
    expect(p).toContain("- CTA fraco: use um verbo de ação");
    expect(p).not.toMatch(/^- \s*$/m);
    expect(p).toContain("Página atual em A2UI Express");
    expect(p).toContain("Café de verdade");
    expect(p).not.toContain("<a2ui>\n");
  });

  it("sem página atual, continua partindo do rascunho", () => {
    const p = userPrompt(starterDraft(), {});
    expect(p).toContain("Esqueleto A2UI Express que já compila");
    expect(p).not.toContain("Correções pedidas");
  });

  it("revisão vira lista de correções (sem o aviso 'sem Reimaginar'; fato novo vira pedido de marcador)", () => {
    const fb = feedbackFrom(
      review([
        { severity: "info", title: "Sem Reimaginar: a revisão olha só o rascunho.", source: "regra", code: "L1" },
        { severity: "warning", title: 'Número novo: "R$ 7,90"', source: "regra", code: "L2" },
        { severity: "error", title: "Proposta pouco clara", suggestion: "Diga o que vende no título.", source: "ia" },
      ]),
    );
    expect(fb).toEqual(['Número novo: "R$ 7,90": troque por um marcador entre colchetes ou remova, se não veio do usuário.', "Proposta pouco clara: Diga o que vende no título."]);
  });

  it("rota aceita página atual e correções (mock devolve a página atual)", async () => {
    const { POST } = await import("@/app/api/reimagine/route");
    const previous = draftToExpress(starterDraft()).replace("café bom no centro", "Título melhorado");
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ draft: starterDraft(), previous, feedback: ["melhore o título"], settings: { kind: "mock" } }) }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(JSON.stringify(json.messages)).toContain("Título melhorado");
  });
});
