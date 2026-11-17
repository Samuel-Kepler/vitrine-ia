import { createNode, type DraftNode } from "./tree";

/** Rascunho inicial: um esqueleto de landing para o usuário não começar do zero. */
export function starterDraft(): DraftNode[] {
  const navbar = createNode("navbar");
  navbar.props = { brand: "Café Aurora", links: "Cardápio\nSobre\nContato", cta: "Reservar" };

  const hero = createNode("hero");
  hero.props = { title: "café bom no centro", subtitle: "grãos especiais, torra da casa", cta: "ver cardápio" };

  const benefits = createNode("section");
  const h = createNode("heading");
  h.props = { text: "por que a gente", level: "2" };
  const f1 = createNode("feature");
  f1.props = { icon: "heart", title: "torra própria", text: "torramos toda semana" };
  const f2 = createNode("feature");
  f2.props = { icon: "clock", title: "abre cedo", text: "7h da manhã" };
  const f3 = createNode("feature");
  f3.props = { icon: "star", title: "wifi", text: "pra trabalhar" };
  benefits.children = [h, f1, f2, f3];

  const form = createNode("form");
  form.props = { title: "receba novidades", fields: "Nome\nE-mail", cta: "quero receber" };

  const footer = createNode("footer");
  footer.props = { text: "© 2026 Café Aurora · Rua das Flores, 120", links: "Instagram\nWhatsApp" };

  return [navbar, hero, benefits, form, footer];
}
