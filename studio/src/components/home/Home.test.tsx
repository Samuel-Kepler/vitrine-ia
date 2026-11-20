// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Home } from "./Home";

afterEach(cleanup);

describe("página inicial", () => {
  it("leva o CTA 'Abrir o Studio' para /studio", () => {
    render(<Home />);
    const ctas = screen.getAllByRole("link", { name: "Abrir o Studio" });
    expect(ctas.length).toBeGreaterThan(0);
    for (const cta of ctas) expect(cta.getAttribute("href")).toBe("/studio");
  });

  it("lista as ferramentas em cartões", () => {
    render(<Home />);
    const tools = within(screen.getByRole("list", { name: "Lista de ferramentas" }));
    for (const name of ["Gerar com IA", "Reimaginar", "Revisão com IA", "Banco", "Exportar projeto", "Projetos"]) {
      expect(tools.getByRole("heading", { level: 3, name })).toBeTruthy();
    }
  });

  it("mostra o fluxo em quatro passos e o atalho 'Como funciona'", () => {
    render(<Home />);
    const steps = within(screen.getByRole("list", { name: "Passos do fluxo" }));
    expect(steps.getAllByRole("listitem")).toHaveLength(4);
    for (const link of screen.getAllByRole("link", { name: "Como funciona" })) expect(link.getAttribute("href")).toBe("#como-funciona");
  });
});
