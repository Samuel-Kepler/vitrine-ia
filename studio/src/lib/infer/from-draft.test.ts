import { describe, expect, it } from "vitest";
import { createNode } from "@/lib/draft/tree";
import { inferFromDraft } from "./from-draft";

function navbar(links: string) {
  const n = createNode("navbar");
  n.props = { brand: "Café", links, cta: "Reservar" };
  return n;
}

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
