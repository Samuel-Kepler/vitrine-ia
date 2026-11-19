import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { starterDraft } from "@/lib/draft/starter";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { compileResponse } from "@/lib/a2ui/agent";
import { draftToExpress } from "@/lib/draft/to-express";
import { AiReviewSchema, ERROR_CAP, inputKey, mergeReview, reviewInput, reviewPrompt, ruleFindings, ruleScore, rulesOnly, type AiReviewRaw, type ReviewState } from "./ai-input";

function assertStrict(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.type === "object" && o.properties) {
    expect([...((o.required as string[]) ?? [])].sort(), `${path}.required`).toEqual(Object.keys(o.properties as object).sort());
  }
  for (const [k, v] of Object.entries(o)) assertStrict(v, `${path}.${k}`);
}

function state(): ReviewState {
  const draft = starterDraft();
  const s = inferFromDraft(draft);
  return { draft, brief: "cafeteria no centro", messages: compileResponse(draftToExpress(draft)).messages, arch: expandArch(s.arch), db: expandDb(s.db) };
}

const RAW: AiReviewRaw = {
  score: 92,
  summary: "Enxuto e correto.",
  issues: [{ severity: "warning", title: "Falta índice em email", suggestion: "Crie um índice único.", target: "LEADS" }],
};

describe("AiReviewSchema", () => {
  it("é compatível com saída estruturada estrita", () => assertStrict(z.toJSONSchema(AiReviewSchema)));
});

describe("entrada do modelo", () => {
  it("cada modo manda o seu conteúdo", () => {
    const s = state();
    expect(reviewInput("landing", s)).toMatch(/Rascunho[\s\S]*Textos da página gerada/);
    expect(reviewInput("arch", s)).toMatch(/Blocos:[\s\S]*Ligações:[\s\S]*→/);
    expect(reviewInput("db", s)).toMatch(/^\/\/ Gerado[\s\S]*Table leads/);
    expect(reviewInput("arch", { ...s, arch: { nodes: [], edges: [] } })).toBe("");
  });

  it("o prompt lista as regras já apontadas para a IA não repetir", () => {
    const s = state();
    s.db.tables[0].columns = s.db.tables[0].columns.map((c) => ({ ...c, pk: false }));
    const p = reviewPrompt("db", s, ruleFindings("db", s));
    expect(p).toMatch(/Problemas já apontados pelas regras:\n- \[error\] .*chave primária/);
  });

  it("a impressão digital muda quando o canvas muda", () => {
    const s = state();
    const before = inputKey("db", s);
    expect(inputKey("db", s)).toBe(before);
    s.db.tables[0].columns.push({ id: "z", name: "extra", type: "text" });
    expect(inputKey("db", s)).not.toBe(before);
  });
});

describe("resultado", () => {
  it("nota só com regras desconta por gravidade", () => {
    expect(ruleScore([])).toBe(100);
    expect(ruleScore([{ code: "x", severity: "error", message: "" }, { code: "y", severity: "warning", message: "" }, { code: "z", severity: "info", message: "" }])).toBe(70);
  });

  it("plano B: provedor falhou -> só regras, com o motivo", () => {
    const r = rulesOnly("db", state(), { provider: "groq", modelId: "m", error: "limite" });
    expect(r).toMatchObject({ fallback: true, error: "limite", mode: "db" });
    expect(r.summary).toMatch(/sem IA/);
    expect(r.issues.every((i) => i.source === "regra")).toBe(true);
  });

  it("junta regras + IA, liga o alvo ao id da tabela (sem diferenciar maiúsculas)", () => {
    const s = state();
    const r = mergeReview("db", s, RAW, { provider: "groq", modelId: "m" });
    const ai = r.issues.filter((i) => i.source === "ia");
    expect(ai).toHaveLength(1);
    expect(ai[0].targetId).toBe(s.db.tables.find((t) => t.name === "leads")!.id);
    expect(r.score).toBe(92);
    expect(r.fallback).toBe(false);
  });

  it("com erro de regra a nota fica no teto, e a IA não duplica a regra", () => {
    const s = state();
    s.db.tables[0].columns = s.db.tables[0].columns.map((c) => ({ ...c, pk: false }));
    const error = ruleFindings("db", s).find((f) => f.code === "D02")!;
    expect(error.severity).toBe("error");
    const r = mergeReview("db", s, { ...RAW, issues: [{ ...RAW.issues[0], title: error.message }] }, { provider: "groq", modelId: "m" });
    expect(r.score).toBe(ERROR_CAP);
    expect(r.issues.filter((i) => i.title === error.message)).toHaveLength(1);
  });

  it("landing: aponta fatos novos da página como regra", () => {
    const s = state();
    const extra = draftToExpress(s.draft).replace(/(page_col = Column\(children=\[)/, 'novo = Text(text="Aberto das 6h às 22h.")\n$1novo, ');
    s.messages = compileResponse(extra).messages;
    expect(ruleFindings("landing", s).some((f) => f.code === "L2" && /6h/.test(f.message))).toBe(true);
    expect(ruleFindings("landing", { ...s, messages: null })[0].code).toBe("L1");
  });
});

describe("POST /api/review", () => {
  const call = async (body: unknown) => {
    const { POST } = await import("@/app/api/review/route");
    return POST(new Request("http://x/api/review", { method: "POST", body: JSON.stringify(body) }));
  };

  it("provedor mock devolve a revisão das regras", async () => {
    const s = state();
    const res = await call({ mode: "db", ...s, settings: { kind: "mock" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ mode: "db", provider: "mock", fallback: true });
    expect(json.inputKey).toBe(inputKey("db", s));
  });

  it("modo vazio dá 400", async () => {
    const s = state();
    const res = await call({ mode: "arch", ...s, arch: { nodes: [], edges: [] }, settings: { kind: "mock" } });
    expect(res.status).toBe(400);
  });
});

describe("sugestões da revisão", () => {
  it("proíbe sugerir fatos concretos (viram texto do site no 'melhorar')", async () => {
    const { reviewSystem } = await import("./ai-input");
    for (const mode of ["landing", "arch", "db"] as const) expect(reviewSystem(mode)).toMatch(/NUNCA proponha fatos concretos/);
  });
});
