import { describe, expect, it } from "vitest";
import type { ErModel, Table } from "@/lib/db/model";
import { tableForPath } from "./codegen";

const t = (name: string): Table => ({ id: name, name, columns: [{ id: "c", name: "id", type: "uuid", pk: true }], position: { x: 0, y: 0 } });
const er = (...names: string[]): ErModel => ({ tables: names.map(t), relations: [] });

describe("tableForPath: rota → tabela", () => {
  it("nome exato continua igual", () => {
    expect(tableForPath("/appointments", er("appointments", "services"))?.name).toBe("appointments");
    expect(tableForPath("/team_members", er("team_members"))?.name).toBe("team_members");
  });

  it("/team → team_members (prefixo team_) gera handler real", () => {
    expect(tableForPath("/team", er("team_members", "services"))?.name).toBe("team_members");
  });

  it("singular/plural: /team ↔ teams, /category ↔ categories", () => {
    expect(tableForPath("/team", er("teams"))?.name).toBe("teams");
    expect(tableForPath("/categories", er("category"))?.name).toBe("category");
    expect(tableForPath("/category", er("categories"))?.name).toBe("categories");
  });

  it("sufixo _segmento: /members → team_members", () => {
    expect(tableForPath("/members", er("team_members"))?.name).toBe("team_members");
  });

  it("sem separadores: /teammembers e /team-members → team_members", () => {
    expect(tableForPath("/teammembers", er("team_members"))?.name).toBe("team_members");
    expect(tableForPath("/team-members", er("team_members"))?.name).toBe("team_members");
  });

  it("ambíguo mantém stub (undefined)", () => {
    expect(tableForPath("/team", er("team_members", "team_roles"))).toBeUndefined();
    expect(tableForPath("/members", er("team_members", "club_members"))).toBeUndefined();
    expect(tableForPath("/team", er("teams", "team_members"))?.name).toBe("teams"); // exato-variante vence o passo 3
  });

  it("sem correspondência: undefined", () => {
    expect(tableForPath("/nada", er("team_members"))).toBeUndefined();
  });

  it("users (auth) nunca casa por regra difusa, só por nome exato", () => {
    expect(tableForPath("/user", er("users"))).toBeUndefined();
    expect(tableForPath("/accounts", er("users"))).toBeUndefined();
    expect(tableForPath("/users", er("users"))?.name).toBe("users");
    expect(tableForPath("/users/me", er("users"))?.name).toBe("users");
  });

  it("parâmetros e aninhamento: usa só o primeiro segmento estático", () => {
    expect(tableForPath("/team/:id", er("team_members"))?.name).toBe("team_members");
    expect(tableForPath("/team/{id}/roles", er("team_members"))?.name).toBe("team_members");
    expect(tableForPath("/services/:id", er("services"))?.name).toBe("services");
    expect(tableForPath("/:id", er("id"))?.name).toBe("id"); // exato preservado
    expect(tableForPath("/:id", er("team_members"))).toBeUndefined();
  });
});
