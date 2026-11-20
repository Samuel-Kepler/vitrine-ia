// "Gerar com IA": texto -> rascunho (blocos do canvas). Puro: roda no cliente
// e no servidor. A IA devolve uma estrutura de dois níveis (blocos da página e
// filhos de seção), compatível com saída estruturada estrita; aqui ela vira
// DraftNode[] válido. Sem IA, um modelo por palavras-chave faz o mesmo papel.
import { z } from "zod/v4";
import { BLOCKS, type BlockType } from "./blocks";
import { createNode, type DraftNode } from "./tree";
import { chromeOf } from "./pages";
import { recipeHints } from "./recipes";

/** Blocos que podem ficar direto na página. */
export const TOP_TYPES = ["navbar", "hero", "section", "form", "footer", "custom"] as const satisfies readonly BlockType[];
/** Blocos que vão dentro de uma seção. */
export const CHILD_TYPES = ["heading", "text", "button", "image", "feature", "testimonial", "pricing", "stat", "faq", "step", "team", "contact", "logos", "gallery", "form", "custom"] as const satisfies readonly BlockType[];

const Prop = z.object({ key: z.string().max(40), value: z.string().max(600) });

export const GeneratedPageSchema = z.object({
  blocks: z
    .array(
      z.object({
        type: z.enum(TOP_TYPES),
        props: z.array(Prop).max(12),
        children: z
          .array(z.object({ type: z.enum(CHILD_TYPES), props: z.array(Prop).max(12) }))
          .max(12)
          .describe('only for type "section"; [] otherwise'),
      }),
    )
    .min(1)
    .max(14),
  notes: z.array(z.string().max(200)).max(4).describe("short notes in Portuguese about what to fill in"),
});
export type GeneratedPage = z.infer<typeof GeneratedPageSchema>;

export type GenerateMode = "replace" | "append";

// ---------------- prompt ----------------

export function blockCatalog(): string {
  const line = (t: BlockType) => {
    const d = BLOCKS[t];
    const fields = d.fields.map((f) => (f.options ? `${f.key} (${f.options.map((o) => o.value).join("|")})` : `${f.key}${f.kind === "lines" ? " (um por linha, separados por \\n)" : ""}`));
    return `- ${t}: ${d.hint}. Campos: ${fields.join(", ") || "nenhum"}`;
  };
  return ["Blocos da página (blocks[].type):", ...TOP_TYPES.map(line), "", "Blocos dentro de uma seção (children[].type):", ...CHILD_TYPES.filter((t) => !(TOP_TYPES as readonly string[]).includes(t)).map(line)].join("\n");
}

export function generateSystem(year = new Date().getFullYear()): string {
  return `Ano atual: ${year}.
Você monta o RASCUNHO de uma landing page com blocos prontos. Responda só com a estrutura pedida.
${blockCatalog()}

Regras:
- Ordem típica: navbar, hero, 3 a 6 seções (cada uma começa com um heading), form se houver contato/reserva/cadastro, footer.
- props é uma lista de {key, value}; use só as chaves dos campos de cada bloco. "children" só em section; nos outros, [].
- Os blocos dentro de children têm SÓ type e props: nunca coloque children dentro de um filho (não há aninhamento além de section → filhos).
- Agrupe: features (2 a 4), testimonials (2 a 3) e pricing (2 a 3) ficam dentro de uma section com heading.
- Os links do navbar são os nomes das seções principais (curtos).
- Seções bem montadas que você pode seguir (adapte ao pedido; não precisa usar todas):
${recipeHints()}
${contentRules(year)}`;
}

/** Regras de conteúdo comuns a "gerar página" e "gerar site". */
function contentRules(year: number): string {
  return `- Textos curtos, diretos, em português do Brasil, no tom do negócio.
- NÃO INVENTE FATOS: nada de preço, horário, endereço, telefone, número, nome de cliente, depoimento ou marca que o usuário não escreveu. Quando faltar, use um marcador entre colchetes, como "[preço]", "[horário]", "[depoimento de um cliente]", "[nome do cliente]".
- Itens de cardápio, produtos, serviços, diferenciais, história, tempo de mercado e prêmios: só os que o usuário citou. Se ele só disse "cardápio", use "[produto 1]", "[produto 2]" com texto "[descrição curta]". Nunca escreva nomes de produtos que ele não escreveu.
- Imagens: deixe url/image vazios (o usuário põe depois); nunca invente endereço de imagem.
- Rodapé: "© ${year} [sua marca]" (ou o nome que o usuário deu).
- Se o usuário não disse o nome do negócio, use "[sua marca]".
- Em notes, diga em 1 a 3 frases o que a pessoa precisa preencher (os marcadores).`;
}

export function generatePrompt(prompt: string, brief?: string): string {
  return [brief?.trim() ? `Briefing: ${brief.trim()}` : "", `Pedido: ${prompt.trim()}`].filter(Boolean).join("\n");
}

// ---------------- estrutura -> DraftNode ----------------

const TEXT_KINDS = new Set(["text", "textarea", "lines"]);

function makeNode(type: BlockType, props: { key: string; value: string }[]): DraftNode {
  const node = createNode(type);
  const def = BLOCKS[type];
  // Campos de texto começam vazios: os padrões da paleta ("R$ 49", "Cliente feliz") seriam fatos inventados.
  const out: Record<string, string> = { ...def.defaults };
  for (const f of def.fields) if (TEXT_KINDS.has(f.kind)) out[f.key] = "";
  for (const { key, value } of props) {
    const f = def.fields.find((x) => x.key === key);
    if (!f) continue;
    if (f.options && !f.options.some((o) => o.value === value)) continue;
    const v = value.replace(/\\n/g, "\n").trim();
    // Endereço de imagem só se for http(s) de verdade; "url-da-imagem.jpg" ou "[imagem]" viram vazio.
    if ((key === "url" || key === "image") && v && !/^https?:\/\/\S+$/.test(v)) continue;
    out[key] = v;
  }
  node.props = out;
  return node;
}

const isChild = (t: string): t is (typeof CHILD_TYPES)[number] => (CHILD_TYPES as readonly string[]).includes(t);

/** Converte a resposta da IA em rascunho válido (seções agrupam blocos soltos). */
export function toDraft(g: GeneratedPage): DraftNode[] {
  const out: DraftNode[] = [];
  for (const b of g.blocks) {
    const node = makeNode(b.type, b.props);
    if (b.type === "section") node.children = b.children.filter((c) => isChild(c.type)).map((c) => makeNode(c.type, c.props));
    out.push(node);
  }
  // Uma navbar no topo e um footer no fim, no máximo.
  const nav = out.find((n) => n.type === "navbar");
  const foot = [...out].reverse().find((n) => n.type === "footer");
  const body = out.filter((n) => n.type !== "navbar" && n.type !== "footer" && !(n.type === "section" && !n.children?.length));
  return [...(nav ? [nav] : []), ...body, ...(foot ? [foot] : [])];
}

// ---------------- modelo sem IA ----------------

interface Rule {
  re: RegExp;
  build: () => DraftNode;
  link?: string;
}

function section(title: string, children: DraftNode[]): DraftNode {
  const s = createNode("section");
  const h = makeNode("heading", [{ key: "text", value: title }]);
  s.children = [h, ...children];
  return s;
}
const child = (type: BlockType, props: Record<string, string>) => makeNode(type, Object.entries(props).map(([key, value]) => ({ key, value })));

const RULES: Rule[] = [
  {
    re: /benef[ií]cio|vantage|diferencia|por ?que/,
    link: "Diferenciais",
    build: () => section("Por que escolher a gente", ["sparkles", "heart", "star"].map((icon, i) => child("feature", { icon, title: `[diferencial ${i + 1}]`, text: "[por que isso importa para o cliente]" }))),
  },
  {
    re: /card[aá]pio|menu|produto|cat[aá]logo|servi[cç]o/,
    link: "Produtos",
    build: () => section("[Produtos ou serviços]", ["check", "check", "check"].map((icon, i) => child("feature", { icon, title: `[item ${i + 1}]`, text: "[descrição curta]" }))),
  },
  {
    re: /sobre|hist[oó]ria|quem somos/,
    link: "Sobre",
    build: () => section("Sobre nós", [child("text", { text: "[conte a história do negócio em 2 ou 3 frases]" })]),
  },
  {
    re: /galeria|foto|imagem|portf[oó]lio/,
    link: "Galeria",
    build: () => section("Galeria", [child("gallery", { images: "", captions: ["[foto 1]", "[foto 2]", "[foto 3]"].join("\n") })]),
  },
  {
    re: /depoimento|avalia[cç]|opini[aã]o|o que (os )?clientes/,
    link: "Depoimentos",
    build: () => section("O que dizem", [1, 2].map(() => child("testimonial", { quote: "[depoimento de um cliente]", author: "[nome do cliente]", role: "" }))),
  },
  {
    re: /pre[cç]o|plano|assinatura|pacote|mensalidade/,
    link: "Planos",
    build: () => section("Planos", [1, 2].map((i) => child("pricing", { name: `[plano ${i}]`, price: "[preço]", period: "", features: "[o que inclui]", cta: "Escolher", highlighted: i === 2 ? "yes" : "no" }))),
  },
  {
    re: /faq|perguntas|d[uú]vidas/,
    link: "Dúvidas",
    build: () => section("Perguntas frequentes", [1, 2, 3].map((i) => child("faq", { question: `[pergunta ${i}]`, answer: "[resposta curta]" }))),
  },
  {
    re: /equipe|profissionais|instrutor|nosso time|time/,
    link: "Equipe",
    build: () => section("Equipe", [1, 2, 3].map((i) => child("team", { name: `[nome ${i}]`, role: "[função]", bio: "", photo: "" }))),
  },
  {
    re: /como funciona|passo a passo|etapas/,
    link: "Como funciona",
    build: () => section("Como funciona", [1, 2, 3].map((i) => child("step", { title: `[etapa ${i}]`, text: "[o que acontece nesta etapa]" }))),
  },
  {
    re: /n[uú]meros|resultados|estat[ií]stica/,
    link: "Resultados",
    build: () => section("Em números", [1, 2, 3].map(() => child("stat", { value: "[número]", label: "[o que esse número mostra]" }))),
  },
  {
    re: /hor[aá]rio|endere[cç]o|localiza|como chegar|onde (fica|estamos)/,
    link: "Onde estamos",
    build: () => section("Onde estamos", [child("contact", { hours: "[dias e horários]", address: "[endereço]", phone: "", email: "", whatsapp: "" })]),
  },
];

function formFor(p: string): DraftNode | undefined {
  if (/reserva|agend/.test(p)) return child("form", { title: "Faça sua reserva", fields: "Nome\nTelefone\nData", cta: "Reservar" });
  if (/or[cç]amento/.test(p)) return child("form", { title: "Peça um orçamento", fields: "Nome\nE-mail\nO que você precisa", cta: "Pedir orçamento" });
  if (/newsletter|novidade|cadastr|lista/.test(p)) return child("form", { title: "Receba novidades", fields: "Nome\nE-mail", cta: "Quero receber" });
  if (/contato|formul|fale|mensagem|whats/.test(p)) return child("form", { title: "Fale com a gente", fields: "Nome\nE-mail\nMensagem", cta: "Enviar" });
  return undefined;
}

/** Primeira frase do pedido, como título provisório (palavras do próprio usuário). */
function heroTitle(prompt: string): string {
  const first = prompt.trim().split(/[.!?\n]/)[0].trim();
  const t = first.length > 70 ? `${first.slice(0, 67).trimEnd()}…` : first;
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "[título principal]";
}

export function templateFromPrompt(prompt: string): DraftNode[] {
  const p = prompt.normalize("NFC").toLowerCase();
  let hits = RULES.filter((r) => r.re.test(p));
  const form = formFor(p);
  if (!hits.length) hits = RULES.filter((r) => r.link === "Diferenciais");
  const links = [...hits.map((r) => r.link!), ...(form ? ["Contato"] : [])];
  return [
    child("navbar", { brand: "[sua marca]", links: links.slice(0, 5).join("\n"), cta: form ? "Fale com a gente" : "" }),
    child("hero", { title: heroTitle(prompt), subtitle: "[uma frase com o principal benefício]", cta: form ? "Quero saber mais" : "" }),
    ...hits.map((r) => r.build()),
    ...(form ? [form] : []),
    child("footer", { text: "© [ano] [sua marca]", links: "" }),
  ];
}

// ---------------- aplicar no canvas ----------------

/**
 * replace: troca a página. Com várias páginas, menu e rodapé são do site:
 * ficam os atuais e só o miolo muda.
 * append: acrescenta o miolo antes do rodapé.
 */
export function mergeGenerated(current: DraftNode[], generated: DraftNode[], mode: GenerateMode, multiPage: boolean): DraftNode[] {
  const body = generated.filter((n) => n.type !== "navbar" && n.type !== "footer");
  const chrome = chromeOf(current);
  if (mode === "replace" && !multiPage) return generated;
  if (mode === "replace") {
    const gen = chromeOf(generated);
    const nav = chrome.navbar ?? gen.navbar;
    const foot = chrome.footer ?? gen.footer;
    return [...(nav ? [nav] : []), ...body, ...(foot ? [foot] : [])];
  }
  const i = current.findIndex((n) => n.type === "footer");
  return i < 0 ? [...current, ...body] : [...current.slice(0, i), ...body, ...current.slice(i)];
}


// ---------------- site inteiro ----------------

const Block = z.object({
  type: z.enum(TOP_TYPES),
  props: z.array(Prop).max(12),
  children: z
    .array(z.object({ type: z.enum(CHILD_TYPES), props: z.array(Prop).max(12) }))
    .max(12)
    .describe('only for type "section"; [] otherwise'),
});

export const GeneratedSiteSchema = z.object({
  navbar: z.object({ props: z.array(Prop).max(6) }).describe("shared menu: brand and cta (links are filled with the page names)"),
  footer: z.object({ props: z.array(Prop).max(4) }).describe("shared footer: text and links"),
  pages: z
    .array(
      z.object({
        name: z.string().min(1).max(30).describe("short page name in Portuguese, used as the menu link"),
        blocks: z.array(Block).min(1).max(10).describe("page body only: no navbar, no footer"),
      }),
    )
    .min(2)
    .max(6),
  notes: z.array(z.string().max(200)).max(4).describe("short notes in Portuguese about what to fill in"),
});
export type GeneratedSite = z.infer<typeof GeneratedSiteSchema>;

export const MAX_SITE_PAGES = 6;

export function generateSiteSystem(year = new Date().getFullYear()): string {
  return `Ano atual: ${year}.
Você monta o RASCUNHO de um SITE pequeno (2 a ${MAX_SITE_PAGES} páginas) com blocos prontos. Responda só com a estrutura pedida.
${blockCatalog()}

Regras:
- A primeira página é a inicial ("Início"): hero + 2 a 4 seções que resumem o negócio e levam às outras páginas.
- Crie uma página para cada assunto que o pedido pede (ex.: Cardápio, Sobre, Galeria, Planos, Contato). Nada de páginas que o pedido não sugere.
- Cada página: um bloco de abertura (hero curto ou section com heading de nível 1) e 1 a 4 seções. Contato/reserva/orçamento vira um bloco form na página Contato.
- navbar: só brand e cta (os links são os nomes das páginas, preenchidos depois). footer: text e links curtos.
- props é uma lista de {key, value}; use só as chaves dos campos de cada bloco. "children" só em section; nos outros, [].
- Os blocos dentro de children têm SÓ type e props: nunca coloque children dentro de um filho (não há aninhamento além de section → filhos).
- Agrupe: features (2 a 4), testimonials (2 a 3) e pricing (2 a 3) ficam dentro de uma section com heading.
${contentRules(year)}`;
}

export interface SiteDraft {
  pages: { name: string; tree: DraftNode[] }[];
  notes: string[];
}

/** Resposta da IA -> páginas com menu (links = nomes das páginas) e rodapé compartilhados. */
export function toSite(g: GeneratedSite): SiteDraft {
  const seen = new Set<string>();
  const pages = g.pages
    .map((p) => ({ name: p.name.trim(), body: toDraft({ blocks: p.blocks.filter((b) => b.type !== "navbar" && b.type !== "footer"), notes: [] }) }))
    .filter((p) => p.name && p.body.length && !seen.has(p.name.toLowerCase()) && seen.add(p.name.toLowerCase()))
    .slice(0, MAX_SITE_PAGES);
  const navbar = makeNode("navbar", g.navbar.props.filter((x) => x.key !== "links"));
  navbar.props.links = pages.map((p) => p.name).join("\n");
  const footer = makeNode("footer", g.footer.props);
  return { pages: pages.map((p) => ({ name: p.name, tree: [navbar, ...p.body, footer] })), notes: g.notes };
}

/** Sem IA: Início + uma página por assunto encontrado no pedido. */
export function templateSite(prompt: string): SiteDraft {
  const p = prompt.normalize("NFC").toLowerCase();
  const hits = RULES.filter((r) => r.re.test(p) && r.link !== "Diferenciais").slice(0, MAX_SITE_PAGES - 2);
  const form = formFor(p) ?? child("form", { title: "Fale com a gente", fields: "Nome\nE-mail\nMensagem", cta: "Enviar" });
  const opening = (title: string) => section(title, [child("text", { text: "[uma frase de apresentação desta página]" })]);
  const pages = [
    { name: "Início", body: [child("hero", { title: heroTitle(prompt), subtitle: "[uma frase com o principal benefício]", cta: "Fale com a gente" }), RULES.find((r) => r.link === "Diferenciais")!.build()] },
    ...hits.map((r) => ({ name: r.link!, body: [r.build()] })),
    { name: "Contato", body: [opening("Contato"), form] },
  ];
  const navbar = child("navbar", { brand: "[sua marca]", links: pages.map((x) => x.name).join("\n"), cta: "" });
  const footer = child("footer", { text: "© [ano] [sua marca]", links: "" });
  return {
    pages: pages.map((x) => ({ name: x.name, tree: [navbar, ...x.body, footer] })),
    notes: ["Modelo automático por palavras-chave: troque os textos entre colchetes pelos dados do seu negócio."],
  };
}
