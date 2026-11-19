import { describe, expect, it } from "vitest";
import { createNode } from "@/lib/draft/tree";
import { inferFromDraft } from "./from-draft";

function navbar(links: string) {
  const n = createNode("navbar");
  n.props = { brand: "Café", links, cta: "Reservar" };
  return n;
}

describe("expandArch: layout", () => {
  it("o banco fica abaixo da API que grava nele, fora do caminho da Fila", async () => {
    const { starterDraft } = await import("@/lib/draft/starter");
    const { expandArch } = await import("./expand");
    const g = expandArch(inferFromDraft(starterDraft()).arch);
    const of = (k: string) => g.nodes.find((n) => n.kind === k)!;
    const api = of("api");
    const db = of("postgres");
    const queue = of("queue");
    expect(db.position.x).toBe(api.position.x);
    expect(db.position.y).toBeGreaterThan(Math.max(...g.nodes.filter((n) => n !== db).map((n) => n.position.y)));
    // a linha api -> banco é vertical e não cruza a coluna da Fila
    expect(queue.position.x).toBeGreaterThan(api.position.x + 200);
    // a sugestão nunca liga a Fila direto no banco
    expect(g.edges.some((e) => e.source === queue.id && e.target === db.id)).toBe(false);
  });
});

describe("inferFromDraft: login", () => {
  it('menu com "Contato" não gera auth nem users', () => {
    const s = inferFromDraft([navbar("Cardápio\nSobre\nContato")]);
    expect(s.arch.nodes.some((n) => n.kind === "auth")).toBe(false);
    expect(s.db.tables.some((t) => t.name === "users")).toBe(false);
  });

  it.each(["Entrar", "Minha conta", "Login", "Minha área", "Área do cliente"])('"%s" gera auth e users', (link) => {
    const s = inferFromDraft([navbar(`Sobre\n${link}`)]);
    expect(s.arch.nodes.some((n) => n.kind === "auth")).toBe(true);
    expect(s.db.tables.some((t) => t.name === "users")).toBe(true);
  });

  it('"Contatos" também não gera auth', () => {
    expect(inferFromDraft([navbar("Contatos")]).arch.nodes.some((n) => n.kind === "auth")).toBe(false);
  });
});

describe("formulário: campos de arquivo e opcionais", () => {
  it("upload/foto e '(opcional)' viram colunas anuláveis, sem o sufixo no nome", () => {
    const form = createNode("form");
    form.props = { ...form.props, fields: "Nome\nE-mail\nUpload de foto\nTelefone (opcional)" };
    const leads = inferFromDraft([form]).db.tables.find((t) => t.name === "leads")!;
    const col = (n: string) => leads.columns.find((c) => c.name === n);
    expect(col("nome")?.nullable).toBeFalsy();
    expect(col("upload_de_foto")).toMatchObject({ type: "varchar", nullable: true });
    expect(col("telefone")).toMatchObject({ type: "varchar", nullable: true });
    expect(leads.columns.some((c) => /opcional/.test(c.name))).toBe(false);
  });
});
