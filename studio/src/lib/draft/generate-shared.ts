// "Gerar com IA": texto -> rascunho (blocos do canvas). Puro: roda no cliente
// e no servidor. A IA devolve uma estrutura de dois níveis (blocos da página e
// filhos de seção), compatível com saída estruturada estrita; aqui ela vira
// DraftNode[] válido. Sem IA, um modelo por palavras-chave faz o mesmo papel.
import { z } from "zod/v4";
import { BLOCKS, type BlockType } from "./blocks";
import { createNode, type DraftNode } from "./tree";
import { chromeOf } from "./pages";

/** Blocos que podem ficar direto na página. */
export const TOP_TYPES = ["navbar", "hero", "section", "form", "footer", "custom"] as const satisfies readonly BlockType[];
/** Blocos que vão dentro de uma seção. */
export const CHILD_TYPES = ["heading", "text", "button", "image", "feature", "testimonial", "pricing", "form", "custom"] as const satisfies readonly BlockType[];

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

function blockCatalog(): string {
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
- Agrupe: features (2 a 4), testimonials (2 a 3) e pricing (2 a 3) ficam dentro de uma section com heading.
- Os links do navbar são os nomes das seções principais (curtos).
- Textos curtos, diretos, em português do Brasil, no tom do negócio.
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
    re: /sobre|hist[oó]ria|quem somos|equipe/,
    link: "Sobre",
    build: () => section("Sobre nós", [child("text", { text: "[conte a história do negócio em 2 ou 3 frases]" })]),
  },
  {
    re: /galeria|foto|imagem|portf[oó]lio/,
    link: "Galeria",
    build: () => section("Galeria", [1, 2, 3].map((i) => child("image", { url: "", alt: `[foto ${i}]` }))),
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
    build: () => section("Perguntas frequentes", [child("text", { text: "[pergunta 1] — [resposta]" }), child("text", { text: "[pergunta 2] — [resposta]" })]),
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

