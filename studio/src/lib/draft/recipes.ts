// Receitas de seção: seções prontas montadas só com blocos que já existem
// (uma section com filhos diretos, o mesmo formato que a IA devolve). Entram
// na paleta como "Meus componentes" de fábrica e viram exemplos no prompt de
// geração. Fatos (preço, horário, endereço, nomes) ficam como [marcador].
import type { BlockType } from "./blocks";
import { createNode, type DraftNode } from "./tree";

export interface SectionRecipe {
  id: string;
  name: string;
  hint: string;
  /** Monta a seção com ids novos a cada chamada. */
  build: () => DraftNode;
}

type Child = [BlockType, Record<string, string>?];

function section(tone: string, kids: Child[]): () => DraftNode {
  return () => {
    const s = createNode("section");
    s.props = { ...s.props, tone };
    s.children = kids.map(([type, props]) => {
      const node = createNode(type);
      node.props = { ...node.props, ...props };
      return node;
    });
    return s;
  };
}

const heading = (text: string): Child => ["heading", { text, level: "2" }];
const text = (t: string): Child => ["text", { text: t }];
const times = <T,>(count: number, make: (i: number) => T): T[] => Array.from({ length: count }, (_, i) => make(i + 1));

export const RECIPES: SectionRecipe[] = [
  {
    id: "cardapio-precos",
    name: "Cardápio com preços",
    hint: "Título e 4 itens com preço",
    build: section("default", [
      heading("Cardápio"),
      text("[uma frase sobre o cardápio]"),
      ...times<Child>(4, (i) => ["menuitem", { name: `[produto ${i}]`, description: "[descrição curta]", price: "[preço]", photo: "" }]),
    ]),
  },
  {
    id: "horario-localizacao",
    name: "Horário e localização",
    hint: "Onde fica, quando abre e como chegar",
    build: section("muted", [
      heading("Onde estamos"),
      text("[como chegar ou ponto de referência]"),
      ["contact", { hours: "[dias e horários]", address: "[endereço]", phone: "[telefone]", whatsapp: "[WhatsApp]", email: "" }],
      ["image", { url: "", alt: "Fachada" }],
    ]),
  },
  {
    id: "chamada-final",
    name: "Chamada final",
    hint: "Faixa de destaque com um botão",
    build: section("accent", [heading("[chamada final: o que a pessoa ganha agindo agora]"), text("[uma frase que tira a última dúvida]"), ["button", { label: "[ação principal]", variant: "primary" }]]),
  },
  {
    id: "antes-depois",
    name: "Antes e depois",
    hint: "Duas fotos lado a lado com legenda",
    build: section("default", [heading("Antes e depois"), text("[o que foi feito]"), ["gallery", { images: "", captions: "Antes\nDepois" }]]),
  },
  {
    id: "numeros-depoimento",
    name: "Números + depoimento",
    hint: "3 números e uma citação grande",
    build: section("default", [
      heading("Em números"),
      ...times<Child>(3, () => ["stat", { value: "[número]", label: "[o que esse número mostra]" }]),
      ["testimonial", { quote: "[depoimento de um cliente]", author: "[nome do cliente]", role: "[cidade ou profissão]", variant: "quote" }],
    ]),
  },
  {
    id: "beneficios",
    name: "Três benefícios",
    hint: "Por que escolher você, em cartões",
    build: section("default", [
      heading("Por que escolher a gente"),
      ...(["heart", "clock", "shield"] as const).map<Child>((icon, i) => ["feature", { icon, title: `[benefício ${i + 1}]`, text: "[por que isso importa para o cliente]", variant: "card" }]),
    ]),
  },
  {
    id: "como-funciona",
    name: "Como funciona",
    hint: "3 passos numerados e um botão",
    build: section("muted", [heading("Como funciona"), ...times<Child>(3, (i) => ["step", { title: `[etapa ${i}]`, text: "[o que acontece nesta etapa]" }]), ["button", { label: "[começar]", variant: "primary" }]]),
  },
  {
    id: "depoimentos",
    name: "Depoimentos",
    hint: "3 clientes falando de você",
    build: section("muted", [heading("O que dizem os clientes"), ...times<Child>(3, (i) => ["testimonial", { quote: "[depoimento de um cliente]", author: `[cliente ${i}]`, role: "[cidade ou profissão]", variant: "card" }])]),
  },
  {
    id: "planos",
    name: "Planos e preços",
    hint: "3 planos, o do meio em destaque",
    build: section("default", [
      heading("Planos"),
      text("[para quem é cada plano]"),
      ...times<Child>(3, (i) => ["pricing", { name: `[plano ${i}]`, price: "[preço]", period: "/mês", features: "[item incluso]\n[item incluso]", cta: "Assinar", highlighted: i === 2 ? "yes" : "no" }]),
    ]),
  },
  {
    id: "faq",
    name: "Perguntas frequentes",
    hint: "4 perguntas que abrem e fecham",
    build: section("default", [heading("Perguntas frequentes"), ...times<Child>(4, (i) => ["faq", { question: `[pergunta frequente ${i}]`, answer: "[resposta curta]" }])]),
  },
  {
    id: "equipe",
    name: "Equipe",
    hint: "Quem atende, com foto ou iniciais",
    build: section("default", [heading("Quem faz"), ...times<Child>(3, () => ["team", { name: "[nome]", role: "[função]", bio: "", photo: "" }])]),
  },
  {
    id: "historia",
    name: "Nossa história",
    hint: "Texto, foto e dois números",
    build: section("muted", [
      heading("Nossa história"),
      text("[como o negócio começou e o que move vocês]"),
      ["image", { url: "", alt: "[foto do espaço ou da equipe]" }],
      ...times<Child>(2, () => ["stat", { value: "[número]", label: "[o que esse número mostra]" }]),
    ]),
  },
  {
    id: "galeria",
    name: "Galeria de fotos",
    hint: "Grade com 6 fotos",
    build: section("default", [heading("Galeria"), ["gallery", { images: "", captions: times(6, (i) => `[foto ${i}]`).join("\n") }]]),
  },
  {
    id: "clientes",
    name: "Clientes e parceiros",
    hint: "Faixa de nomes e uma citação",
    build: section("default", [
      ["logos", { title: "Quem confia na gente", names: times(5, (i) => `[cliente ${i}]`).join("\n"), variant: "marquee" }],
      ["testimonial", { quote: "[depoimento de um cliente]", author: "[nome do cliente]", role: "[cargo, empresa]", variant: "quote" }],
    ]),
  },
  {
    id: "contato-formulario",
    name: "Contato com formulário",
    hint: "Formulário e dados de contato",
    build: section("muted", [
      heading("Fale com a gente"),
      text("[em quanto tempo vocês respondem]"),
      ["form", { title: "Mande uma mensagem", fields: "Nome\nE-mail\nMensagem", cta: "Enviar" }],
      ["contact", { hours: "[dias e horários]", address: "", phone: "[telefone]", email: "[e-mail]", whatsapp: "[WhatsApp]" }],
    ]),
  },
  {
    id: "agendamento",
    name: "Agendamento",
    hint: "Passos para marcar horário",
    build: section("default", [
      heading("Agende seu horário"),
      ["step", { title: "Escolha o serviço", text: "[serviços disponíveis]" }],
      ["step", { title: "Marque o horário", text: "[como marcar: WhatsApp, telefone ou site]" }],
      ["step", { title: "É só vir", text: "[o que trazer ou como se preparar]" }],
      ["button", { label: "Agendar pelo WhatsApp", variant: "primary" }],
    ]),
  },
  {
    id: "servicos",
    name: "Lista de serviços",
    hint: "4 serviços com ícone ao lado",
    build: section("default", [
      heading("Serviços"),
      ...(["sparkles", "star", "check", "zap"] as const).map<Child>((icon, i) => ["feature", { icon, title: `[serviço ${i + 1}]`, text: "[o que inclui e para quem é]", variant: "icon-left" }]),
      ["button", { label: "[pedir orçamento]", variant: "default" }],
    ]),
  },
  {
    id: "garantia",
    name: "Garantia",
    hint: "Promessa que tira o risco da compra",
    build: section("dark", [
      ["feature", { icon: "shield", title: "[sua garantia em poucas palavras]", text: "[como funciona a garantia]", variant: "minimal" }],
      ["button", { label: "[ação principal]", variant: "primary" }],
    ]),
  },
];

export function findRecipe(id: string): SectionRecipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/** Resumo das receitas para o prompt da IA: nome e sequência de blocos. */
export function recipeHints(): string {
  const shape = (s: DraftNode) => {
    const parts: string[] = [];
    for (const c of s.children ?? []) {
      const last = parts.at(-1);
      const m = last?.match(/^(\w+)(?:×(\d+))?$/);
      if (m && m[1] === c.type) parts[parts.length - 1] = `${c.type}×${Number(m[2] ?? 1) + 1}`;
      else parts.push(c.type);
    }
    return parts.join(", ");
  };
  return RECIPES.map((r) => {
    const s = r.build();
    return `- ${r.name} (tone ${s.props.tone}): ${shape(s)}`;
  }).join("\n");
}

