import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { normalizeSuggestion, SuggestionSchema } from "./suggest";
import { sourceLine } from "@/components/flow/suggest-client";

// Groq/OpenAI em modo estrito recusam o schema se algum objeto tiver
// propriedade fora de "required" (era a causa do fallback do Sugerir).
function assertStrict(node: unknown, path = "$"): void {
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  if (o.type === "object" && o.properties) {
    const keys = Object.keys(o.properties as object).sort();
    expect([...((o.required as string[]) ?? [])].sort(), `${path}.required`).toEqual(keys);
  }
  for (const [k, v] of Object.entries(o)) assertStrict(v, `${path}.${k}`);
}

describe("SuggestionSchema", () => {
  it("é compatível com saída estruturada estrita", () => {
    assertStrict(z.toJSONSchema(SuggestionSchema));
  });

  it("normaliza null -> ausente", () => {
    const s = normalizeSuggestion({
      arch: { nodes: [{ key: "api", kind: "api", name: "API", routes: null }], edges: [] },
      db: { tables: [{ name: "leads", columns: [{ name: "id", type: "uuid", pk: true, nullable: null, unique: null, default: "uuid" }] }], relations: [] },
      notes: [],
    });
    expect(s.arch.nodes[0]).toEqual({ key: "api", kind: "api", name: "API" });
    expect(s.db.tables[0].columns[0]).toEqual({ name: "id", type: "uuid", pk: true, default: "uuid" });
  });

  it("a linha Fonte mostra o motivo do fallback", () => {
    expect(sourceLine({ fallback: true, provider: "groq", modelId: "m", error: "Limite atingido." })).toContain("falhou: Limite atingido.");
    expect(sourceLine({ fallback: false, provider: "groq", modelId: "m" })).toBe("Fonte: groq · m");
  });
});
