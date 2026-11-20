// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Feature, PricingCard, withSlots } from "./landing-components";

afterEach(() => cleanup());

describe("withSlots", () => {
  it("troca placeholder entre colchetes por chip lp-slot, sem os colchetes", () => {
    const { container } = render(<p>{withSlots("Pago [preço] por mês")}</p>);
    const slot = container.querySelector(".lp-slot");
    expect(slot?.textContent).toBe("preço");
    expect(slot?.getAttribute("title")).toBe("Preencha antes de publicar");
    expect(container.textContent).toBe("Pago preço por mês");
    expect(container.innerHTML).not.toContain("[preço]");
  });

  it("devolve o texto igual quando não há colchetes", () => {
    expect(withSlots("Sem placeholder")).toBe("Sem placeholder");
    expect(withSlots(undefined)).toBeUndefined();
  });

  it("ignora colchetes vazios ou sem fechamento", () => {
    expect(withSlots("[] e [a")).toBe("[] e [a");
  });
});

describe("componentes da landing mostram placeholders como chip", () => {
  it("preço no card de plano não aparece com colchetes", () => {
    const { container } = render(<PricingCard name="Plano [nome]" price="[preço]" features={["Item [detalhe]"]} cta="Assinar" />);
    expect(container.querySelectorAll(".lp-slot")).toHaveLength(3);
    expect(container.textContent).not.toContain("[");
    expect(container.textContent).toContain("preço");
  });

  it("texto de benefício com placeholder vira chip", () => {
    const { container } = render(<Feature title="[título]" text="Atendimento [horário]" />);
    expect(container.querySelector(".lp-slot")?.textContent).toBe("título");
    expect(container.textContent).toContain("Atendimento horário");
  });

  it("texto sem colchetes fica inalterado", () => {
    const { container } = render(<Feature title="Rápido" text="Sem nada especial" />);
    expect(container.querySelector(".lp-slot")).toBeNull();
    expect(container.textContent).toBe("RápidoSem nada especial");
  });
});
