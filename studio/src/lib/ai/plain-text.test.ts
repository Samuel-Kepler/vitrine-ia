import { describe, expect, it } from "vitest";
import { plainText } from "./plain-text";

describe("plainText", () => {
  it("tira negrito, itálico e código, mantendo o conteúdo", () => {
    expect(plainText("**Formulário de Agendamento**")).toBe("Formulário de Agendamento");
    expect(plainText("Tabela **appointments** e __users__")).toBe("Tabela appointments e users");
    expect(plainText("Use *leads* e _planos_ com `POST /leads`")).toBe("Use leads e planos com POST /leads");
  });

  it("tira bullets de emoji e símbolo no começo da linha", () => {
    expect(plainText("🟢 **Formulário** → tabela leads")).toBe("Formulário → tabela leads");
    expect(plainText("📋 Planos")).toBe("Planos");
    expect(plainText("⚠️ Revise o preço")).toBe("Revise o preço");
    expect(plainText("👨‍👩‍👧 Família")).toBe("Família");
    expect(plainText("• Item")).toBe("Item");
  });

  it("tira títulos e marcadores de lista", () => {
    expect(plainText("## Resumo")).toBe("Resumo");
    expect(plainText("- Primeiro\n* Segundo\n1. Terceiro")).toBe("Primeiro\nSegundo\nTerceiro");
    expect(plainText("- 🟢 **Depoimentos**: tabela testimonials")).toBe("Depoimentos: tabela testimonials");
  });

  it("colapsa espaços repetidos e apara as pontas", () => {
    expect(plainText("  Formulário   de   contato  ")).toBe("Formulário de contato");
  });

  it("não mexe em texto comum", () => {
    expect(plainText("R$ 45 por mês")).toBe("R$ 45 por mês");
    expect(plainText("5*3")).toBe("5*3");
    expect(plainText("2*3 e 4*5")).toBe("2*3 e 4*5");
    expect(plainText("arquivo my_file_name")).toBe("arquivo my_file_name");
    expect(plainText("rota /team_members")).toBe("rota /team_members");
    expect(plainText("© 2026 [sua marca]")).toBe("© 2026 [sua marca]");
    expect(plainText("#1 da lista")).toBe("#1 da lista");
    expect(plainText("2024. Ano novo")).toBe("2024. Ano novo");
  });
});
