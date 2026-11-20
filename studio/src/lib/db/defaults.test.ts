import { describe, expect, it } from "vitest";
import { canonicalDefault, type ErModel } from "./model";
import { toDbml, toDrizzle, toPrisma, toSql } from "./codegen";

// Regressão: o gpt-oss sugeriu default "uuid_generate_v4()" e "now()"; o gerador
// colocava entre aspas ('uuid_generate_v4()') e a migração do Postgres falhava.
const model: ErModel = {
  tables: [
    {
      id: "t1",
      name: "appointments",
      position: { x: 0, y: 0 },
      columns: [
        { id: "c1", name: "id", type: "uuid", pk: true, default: "uuid_generate_v4()" },
        { id: "c2", name: "status", type: "varchar", default: "'pendente'" },
        { id: "c3", name: "created_at", type: "timestamp", default: "now()" },
        { id: "c4", name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP" },
      ],
    },
  ],
  relations: [],
};

describe("canonicalDefault", () => {
  it("normaliza expressões SQL para os marcadores do modelo", () => {
    expect(canonicalDefault("now()")).toBe("now");
    expect(canonicalDefault(" CURRENT_TIMESTAMP ")).toBe("now");
    expect(canonicalDefault("(gen_random_uuid())")).toBe("uuid");
    expect(canonicalDefault("uuid_generate_v4()")).toBe("uuid");
    expect(canonicalDefault("serial")).toBe("autoincrement");
    expect(canonicalDefault("pendente")).toBe("pendente");
    expect(canonicalDefault("  ")).toBeUndefined();
  });
});

describe("geradores com defaults escritos como SQL", () => {
  it("Postgres usa funções sem aspas", () => {
    const sql = toSql(model, "postgres");
    expect(sql).toContain("DEFAULT gen_random_uuid()");
    expect(sql).toContain("DEFAULT CURRENT_TIMESTAMP");
    expect(sql).not.toMatch(/'uuid_generate_v4\(\)'|'now\(\)'|'CURRENT_TIMESTAMP'/);
  });
  it("Prisma, Drizzle e DBML também", () => {
    expect(toPrisma(model)).toContain("@default(uuid())");
    expect(toPrisma(model)).toContain("@default(now())");
    expect(toDrizzle(model)).toContain(".defaultRandom()");
    expect(toDrizzle(model)).toContain(".defaultNow()");
    expect(toDbml(model)).toContain("default: `now()`");
  });
});
