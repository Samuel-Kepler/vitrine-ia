// Blocos que o usuário arrasta para o canvas de UI. O rascunho é uma árvore
// simples ({id, type, props, children}); a IA (ou o compilador determinístico)
// transforma essa árvore em componentes A2UI.

export type FieldKind = "text" | "textarea" | "select" | "lines";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export type BlockGroup = "layout" | "conteudo" | "secoes" | "livre";

export interface BlockDef {
  type: BlockType;
  label: string;
  group: BlockGroup;
  hint: string;
  /** Recebe filhos. `direction` define como o canvas os empilha. */
  container?: { direction: "row" | "column" };
  defaults: Record<string, string>;
  fields: FieldDef[];
}

export const BLOCK_TYPES = [
  "section",
  "row",
  "column",
  "card",
  "navbar",
  "hero",
  "heading",
  "text",
  "button",
  "image",
  "feature",
  "testimonial",
  "pricing",
  "form",
  "footer",
  "custom",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const FEATURE_ICONS = ["sparkles", "zap", "shield", "heart", "clock", "star", "rocket", "check"] as const;

const TONES = [
  { value: "default", label: "Padrão" },
  { value: "muted", label: "Suave" },
  { value: "accent", label: "Destaque" },
  { value: "dark", label: "Escuro" },
  { value: "gradient", label: "Gradiente" },
];

const AUTO = { value: "auto", label: "A IA escolhe" };
const HERO_STYLES = [AUTO, { value: "centered", label: "Centralizado" }, { value: "split", label: "Dividido (texto + imagem)" }, { value: "image-bg", label: "Imagem de fundo" }, { value: "gradient", label: "Gradiente" }, { value: "minimal", label: "Minimalista" }];
const FEATURE_STYLES = [AUTO, { value: "card", label: "Cartão" }, { value: "icon-left", label: "Ícone ao lado" }, { value: "minimal", label: "Mínimo" }];
const TESTIMONIAL_STYLES = [AUTO, { value: "card", label: "Cartão" }, { value: "quote", label: "Citação grande" }];

export const BLOCKS: Record<BlockType, BlockDef> = {
  section: {
    type: "section",
    label: "Seção",
    group: "layout",
    hint: "Faixa da página que agrupa blocos",
    container: { direction: "column" },
    defaults: { tone: "default" },
    fields: [{ key: "tone", label: "Fundo", kind: "select", options: TONES }],
  },
  row: {
    type: "row",
    label: "Linha",
    group: "layout",
    hint: "Coloca blocos lado a lado",
    container: { direction: "row" },
    defaults: {},
    fields: [],
  },
  column: {
    type: "column",
    label: "Coluna",
    group: "layout",
    hint: "Empilha blocos",
    container: { direction: "column" },
    defaults: {},
    fields: [],
  },
  card: {
    type: "card",
    label: "Cartão",
    group: "layout",
    hint: "Caixa com borda",
    container: { direction: "column" },
    defaults: {},
    fields: [],
  },
  navbar: {
    type: "navbar",
    label: "Menu",
    group: "secoes",
    hint: "Marca, links e botão",
    defaults: { brand: "Minha marca", links: "Produto\nPreços\nContato", cta: "Começar" },
    fields: [
      { key: "brand", label: "Marca", kind: "text" },
      { key: "links", label: "Links (um por linha)", kind: "lines" },
      { key: "cta", label: "Botão", kind: "text" },
    ],
  },
  hero: {
    type: "hero",
    label: "Hero",
    group: "secoes",
    hint: "Título grande com chamada",
    defaults: { title: "Seu produto em uma frase", subtitle: "Explique o benefício principal.", cta: "Quero conhecer", variant: "auto" },
    fields: [
      { key: "title", label: "Título", kind: "text" },
      { key: "subtitle", label: "Subtítulo", kind: "textarea" },
      { key: "cta", label: "Botão", kind: "text" },
      { key: "image", label: "Imagem (URL)", kind: "text", placeholder: "https://..." },
      { key: "variant", label: "Estilo", kind: "select", options: HERO_STYLES },
    ],
  },
  heading: {
    type: "heading",
    label: "Título",
    group: "conteudo",
    hint: "Título de seção",
    defaults: { text: "Título da seção", level: "2" },
    fields: [
      { key: "text", label: "Texto", kind: "text" },
      {
        key: "level",
        label: "Nível",
        kind: "select",
        options: [
          { value: "1", label: "H1" },
          { value: "2", label: "H2" },
          { value: "3", label: "H3" },
        ],
      },
    ],
  },
  text: {
    type: "text",
    label: "Texto",
    group: "conteudo",
    hint: "Parágrafo",
    defaults: { text: "Um parágrafo curto sobre o seu negócio." },
    fields: [{ key: "text", label: "Texto", kind: "textarea" }],
  },
  button: {
    type: "button",
    label: "Botão",
    group: "conteudo",
    hint: "Chamada para ação",
    defaults: { label: "Saiba mais", variant: "primary" },
    fields: [
      { key: "label", label: "Texto", kind: "text" },
      {
        key: "variant",
        label: "Estilo",
        kind: "select",
        options: [
          { value: "primary", label: "Principal" },
          { value: "default", label: "Secundário" },
          { value: "borderless", label: "Link" },
        ],
      },
    ],
  },
  image: {
    type: "image",
    label: "Imagem",
    group: "conteudo",
    hint: "Foto ou ilustração",
    defaults: { url: "", alt: "Imagem" },
    fields: [
      { key: "url", label: "URL", kind: "text", placeholder: "https://..." },
      { key: "alt", label: "Descrição", kind: "text" },
    ],
  },
  feature: {
    type: "feature",
    label: "Benefício",
    group: "conteudo",
    hint: "Ícone, título e texto",
    defaults: { icon: "sparkles", title: "Benefício", text: "Por que isso importa para o cliente.", variant: "auto" },
    fields: [
      { key: "icon", label: "Ícone", kind: "select", options: ICON_OPTIONS() },
      { key: "title", label: "Título", kind: "text" },
      { key: "text", label: "Texto", kind: "textarea" },
      { key: "variant", label: "Estilo", kind: "select", options: FEATURE_STYLES },
    ],
  },
  testimonial: {
    type: "testimonial",
    label: "Depoimento",
    group: "conteudo",
    hint: "Citação de cliente",
    defaults: { quote: "Mudou a forma como trabalhamos.", author: "Cliente feliz", role: "Cargo, Empresa", variant: "auto" },
    fields: [
      { key: "quote", label: "Citação", kind: "textarea" },
      { key: "author", label: "Autor", kind: "text" },
      { key: "role", label: "Cargo", kind: "text" },
      { key: "variant", label: "Estilo", kind: "select", options: TESTIMONIAL_STYLES },
    ],
  },
  pricing: {
    type: "pricing",
    label: "Plano",
    group: "conteudo",
    hint: "Cartão de preço",
    defaults: { name: "Pro", price: "R$ 49", period: "/mês", features: "Tudo do básico\nSuporte prioritário", cta: "Assinar", highlighted: "no" },
    fields: [
      { key: "name", label: "Nome", kind: "text" },
      { key: "price", label: "Preço", kind: "text" },
      { key: "period", label: "Período", kind: "text" },
      { key: "features", label: "Itens (um por linha)", kind: "lines" },
      { key: "cta", label: "Botão", kind: "text" },
      {
        key: "highlighted",
        label: "Destacado",
        kind: "select",
        options: [
          { value: "no", label: "Não" },
          { value: "yes", label: "Sim" },
        ],
      },
    ],
  },
  form: {
    type: "form",
    label: "Formulário",
    group: "secoes",
    hint: "Captura de contatos",
    defaults: { title: "Fale com a gente", fields: "Nome\nE-mail", cta: "Enviar" },
    fields: [
      { key: "title", label: "Título", kind: "text" },
      { key: "fields", label: "Campos (um por linha)", kind: "lines" },
      { key: "cta", label: "Botão", kind: "text" },
    ],
  },
  footer: {
    type: "footer",
    label: "Rodapé",
    group: "secoes",
    hint: "Texto final e links",
    defaults: { text: "© 2026 Minha marca", links: "Privacidade\nTermos" },
    fields: [
      { key: "text", label: "Texto", kind: "text" },
      { key: "links", label: "Links (um por linha)", kind: "lines" },
    ],
  },
  custom: {
    type: "custom",
    label: "Bloco livre",
    group: "livre",
    hint: "Descreva e a IA interpreta",
    defaults: { name: "Logos de clientes", description: "Uma faixa com logos de empresas que já usam o produto." },
    fields: [
      { key: "name", label: "Nome", kind: "text" },
      { key: "description", label: "O que deve ter", kind: "textarea" },
    ],
  },
};

function ICON_OPTIONS() {
  return FEATURE_ICONS.map((i) => ({ value: i, label: i }));
}

export const GROUP_LABELS: Record<BlockGroup, string> = {
  secoes: "Seções prontas",
  conteudo: "Conteúdo",
  layout: "Layout",
  livre: "Livre",
};
