import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { createNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { checkFacts, factWarnings } from "./fact-check";

const BRIEF = "cafeteria no centro, grãos especiais, wifi pra trabalhar";

function cafeteria() {
  const draft = starterDraft();
  const logos = createNode("custom");
  logos.props = { ...logos.props, name: "Logos de clientes", description: "faixa com logos" };
  return [...draft, logos];
}

/** Página como o Qwen devolveu: validada, mas com fatos novos. */
function invented(draft: ReturnType<typeof cafeteria>) {
  const base = draftToExpress(draft, { palette: "sunset" });
  const extra = [
    'badge = Text(text="Cafetaria & Lounge")',
    'wifi = Text(text="Wi-Fi de alta velocidade e tomadas em todas as mesas.")',
    'logos_txt = Text(text="Fornecemos café fresco para escritórios e eventos corporativos da região, como a Acme Ltda.")',
    'preco = Text(text="Espresso por R$ 7,90. Aberto das 6h às 22h, todos os dias.")',
    'fone = Text(text="Ligue (11) 98765-4321 e ganhe 15% de desconto.")',
  ];
  // anexa os textos inventados como filhos da coluna principal
  const express = base.replace(/(page_col = Column\(children=\[)/, `${extra.join("\n")}\n$1badge, wifi, logos_txt, preco, fone, `);
  return compileResponse(express).messages;
}

describe("checkFacts", () => {
  it("a página automática do próprio rascunho não gera aviso (sem falso positivo)", () => {
    const draft = cafeteria();
    const { messages } = compileResponse(draftToExpress(draft, { palette: "sunset" }));
    expect(checkFacts(messages, draft, BRIEF)).toEqual([]);
  });

  it("caso Cafeteria: aponta nomes e números que não estavam na entrada", () => {
    const draft = cafeteria();
    const found = checkFacts(invented(draft), draft, BRIEF);
    const values = found.map((f) => f.value);
    expect(values).toEqual(expect.arrayContaining(["Cafetaria & Lounge", "Acme Ltda", "R$ 7,90", "6h", "22h", "(11) 98765-4321", "15%"]));
    // "Café Aurora", "Wi-Fi" e rótulos de navegação existem na entrada ou são padrão
    expect(values.some((v) => /Aurora|^Wi-Fi$|Contato|Cardápio|^R$/.test(v))).toBe(false);
    expect(factWarnings(found)[0]).toMatch(/^(Nome|Número) novo: "/);
  });
});

describe("prompts", () => {
  it("Reimaginar e Sugerir proíbem inventar fatos", async () => {
    const { systemPrompt } = await import("./prompt");
    const sys = systemPrompt("");
    expect(sys).toContain("NÃO INVENTE FATOS");
    expect(sys).toContain("Wi-Fi para quem trabalha daqui");
    expect(sys).toMatch(/Logos de clientes/);
    expect(sys).not.toMatch(/acrescente no máximo uma seção/);
    const suggestSrc = (await import("node:fs")).readFileSync("src/lib/infer/suggest.ts", "utf8");
    expect(suggestSrc).toContain("Não invente funcionalidades");
  });
});

describe("hífens tipográficos", () => {
  it('"Wi‑Fi" com hífen especial (U+2011) não vira o nome "Fi"', async () => {
    const { compileResponse } = await import("@/lib/a2ui/agent");
    const draft = cafeteria();
    const express = draftToExpress(draft, { palette: "sunset" }).replace(/(page_col = Column\(children=\[)/, 'w = Text(text="Wi‑Fi rápido e tomadas.")\n$1w, ');
    expect(checkFacts(compileResponse(express).messages, draft, BRIEF).map((f) => f.value)).not.toContain("Fi");
  });
});
