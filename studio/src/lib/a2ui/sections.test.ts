import { describe, expect, it } from "vitest";
import { createNode, type DraftNode } from "@/lib/draft/tree";
import { draftToExpress } from "@/lib/draft/to-express";
import { compileResponse } from "@/lib/a2ui/agent";
import { pageToTsx } from "@/lib/export/react";
import { templateFromPrompt, templateSite } from "@/lib/draft/generate-shared";
import { checkFacts } from "@/lib/reimagine/fact-check";
import { systemPrompt } from "@/lib/reimagine/prompt";

const n = (type: Parameters<typeof createNode>[0], props: Record<string, string> = {}, children?: DraftNode[]): DraftNode => {
  const x = createNode(type);
  x.props = { ...x.props, ...props };
  if (children) x.children = children;
  return x;
};

function page(): DraftNode[] {
  return [
    n("navbar", { brand: "Barbearia Navalha", links: "Serviços\nContato" }),
    n("section", { tone: "default" }, [n("heading", { text: "Em números" }), n("stat", { value: "12 anos", label: "de casa" }), n("stat", { value: "+3 mil", label: "cortes por ano" })]),
    n("section", { tone: "muted" }, [n("heading", { text: "Como funciona" }), n("step", { title: "Agende" }), n("step", { title: "Venha" }), n("step", { title: "Saia na régua" })]),
    n("section", { tone: "default" }, [n("team", { name: "Rafael Souza", role: "Barbeiro", photo: "https://example.com/r.jpg" }), n("team", { name: "Diego", role: "Barbeiro", photo: "javascript:alert(1)" })]),
    n("section", { tone: "muted" }, [n("faq", { question: "Precisa agendar?", answer: "Sim, pelo WhatsApp." }), n("faq", { question: "Aceita cartão?", answer: "Sim." })]),
    n("contact", { hours: "Ter a sáb: 9h às 20h", address: "Rua A, 10", phone: "(31) 3333-4444", whatsapp: "(31) 99876-5432", email: "oi@navalha.com" }),
    n("logos", { title: "Parceiros", names: "Café Aurora\nPadaria Sol" }),
    n("gallery", { images: "https://example.com/1.jpg\nhttps://example.com/2.jpg", captions: "Degradê\nBarba" }),
    n("footer", { text: "© Navalha" }),
  ];
}

describe("seções novas no A2UI", () => {
  it("compila e valida; números, passos e equipe viram grade; passos numerados", () => {
    const express = draftToExpress(page());
    expect(express).toMatch(/Grid\(children=\[[^\]]+\], columns="2"\)/);
    expect(express).toMatch(/Step\(title="Agende", text="[^"]*", index="1"\)/);
    expect(express).toMatch(/Step\(title="Saia na régua", text="[^"]*", index="3"\)/);
    expect(express).toContain('photo="https://example.com/r.jpg"');
    expect(express).not.toContain("javascript:");
    expect(express).toMatch(/ContactInfo\(hours=\["Ter a sáb: 9h às 20h"\], address="Rua A, 10"/);
    const r = compileResponse(express);
    expect((r as { errors?: unknown[] }).errors ?? []).toEqual([]);
    const types = new Set<string>();
    JSON.stringify(r.messages, (k, v) => (k === "component" && typeof v === "string" ? (types.add(v), v) : v));
    for (const t of ["Stat", "Step", "TeamMember", "FaqItem", "ContactInfo", "LogoStrip", "Gallery"]) expect(types.has(t), t).toBe(true);
  });

  it("vão para o projeto React", () => {
    const { messages } = compileResponse(draftToExpress(page()));
    const { code } = pageToTsx({ name: "Início", file: "index.html", messages }, () => "#");
    for (const c of ["<Stat ", "<Step ", "<TeamMember ", "<FaqItem ", "<ContactInfo ", "<LogoStrip ", "<Gallery "]) expect(code, c).toContain(c);
    expect(code).toContain('whatsapp={"(31) 99876-5432"}');
    expect(code).not.toMatch(/não exportado/);
  });

  it("dados do próprio rascunho não geram aviso de fato inventado", () => {
    const draft = page();
    const { messages } = compileResponse(draftToExpress(draft));
    expect(checkFacts(messages, draft)).toEqual([]);
  });
});

describe("geração sem IA usa os blocos novos", () => {
  it("perguntas, galeria, equipe, passos, números e endereço", () => {
    const types = (d: DraftNode[]) => d.flatMap((x) => [x.type, ...(x.children ?? []).map((c) => c.type)]);
    const t = types(templateFromPrompt("barbearia com perguntas frequentes, galeria, equipe, como funciona, números e endereço"));
    for (const b of ["faq", "gallery", "team", "step", "stat", "contact"]) expect(t, b).toContain(b);
    expect(templateSite("barbearia com equipe e horário de funcionamento").pages.map((p) => p.name)).toEqual(["Início", "Equipe", "Onde estamos", "Contato"]);
  });
  it("prompt do Reimaginar cita as seções prontas e a regra de dados reais", () => {
    expect(systemPrompt("")).toMatch(/Stat .*só números reais/);
  });
});
