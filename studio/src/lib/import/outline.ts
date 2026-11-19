// Importar um site existente (arquivos .html) para o rascunho do Studio.
//
// 1. extractOutline: lê o HTML (DOMParser, no navegador; não executa scripts)
//    e guarda só o conteúdo: títulos, textos, botões, imagens, menu, rodapé.
// 2. outlineToDraft: converte o esboço em blocos sem IA (funciona offline/mock).
//    Com IA, outlineToPrompt vira o pedido e o servidor monta os blocos.
// Depois disso é o fluxo normal: Reimaginar transforma o rascunho em A2UI.
import { z } from "zod";
import { createNode, type DraftNode } from "@/lib/draft/tree";

const MAX_ITEMS = 120;
export const MAX_IMPORT_PAGES = 6;

export const OutlineItemSchema = z.object({
  kind: z.enum(["h1", "h2", "h3", "p", "li", "button", "img", "field"]),
  text: z.string().max(400),
  src: z.string().max(1000).optional(),
});
export type OutlineItem = z.infer<typeof OutlineItemSchema>;

export const PageOutlineSchema = z.object({
  file: z.string().max(200),
  title: z.string().max(200),
  brand: z.string().max(80),
  nav: z.array(z.string().max(40)).max(8),
  items: z.array(OutlineItemSchema).max(MAX_ITEMS),
  footer: z.object({ text: z.string().max(200), links: z.array(z.string().max(40)).max(8) }),
});
export type PageOutline = z.infer<typeof PageOutlineSchema>;

const clean = (s: string | null | undefined, max = 400) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const isHttpUrl = (s: string) => /^https?:\/\/\S+$/i.test(s);
const SKIP = "script, style, noscript, template, svg, iframe, object, nav";
const BUTTONISH = /\b(btn|button|cta)\b/i;

/** Nome da página a partir do arquivo: "sobre-nos.html" -> "Sobre nos"; index -> Início. */
export function pageNameFromFile(file: string, title: string): string {
  const base = file.split(/[\\/]/).pop()!.replace(/\.html?$/i, "");
  if (/^(index|home|inicio)$/i.test(base)) return "Início";
  const fromTitle = clean(title.split(/\s[|–—-]\s/)[0], 30);
  const fromFile = base.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return (fromFile.length <= 30 ? fromFile : fromTitle) || fromTitle || "Página";
}

const SKIP_INPUT_TYPES = ["hidden", "submit", "button", "checkbox", "radio", "reset", "image"];

/** Rótulo de um campo: <label for>, <label> em volta, <label> logo antes, aria-label, placeholder ou name. */
function fieldLabel(f: Element, scope: ParentNode): string {
  if (SKIP_INPUT_TYPES.includes((f.getAttribute("type") ?? "").toLowerCase())) return "";
  const id = f.getAttribute("id");
  const forLabel = id ? [...scope.querySelectorAll("label")].find((l) => l.getAttribute("for") === id) : undefined;
  // Só o irmão imediato: pular elementos pegaria o rótulo do campo anterior.
  const prev = f.previousElementSibling;
  const before = prev?.tagName === "LABEL" && !prev.getAttribute("for") ? prev : undefined;
  const label = forLabel?.textContent || f.closest("label")?.textContent || before?.textContent || f.getAttribute("aria-label") || f.getAttribute("placeholder") || f.getAttribute("name");
  return clean(label, 40);
}

/** Lê o conteúdo de um documento HTML já parseado. */
export function extractOutline(doc: Document, file: string): PageOutline {
  const title = clean(doc.title, 200) || clean(doc.querySelector("h1")?.textContent, 200) || file;
  const brandEl = doc.querySelector("header .logo, header [class*='brand'], .navbar-brand, header a[href='/'], header a[href='index.html']");
  const brand =
    clean(brandEl?.textContent, 80) ||
    clean(brandEl?.querySelector("img")?.getAttribute("alt"), 80) ||
    clean(title.split(/\s[|–—-]\s/).pop(), 80);

  const navLinks = [...doc.querySelectorAll("nav a, header a")]
    .map((a) => clean(a.textContent, 40))
    .filter((t) => t && t.toLowerCase() !== brand.toLowerCase());
  const nav = [...new Set(navLinks)].slice(0, 8);

  const footerEl = doc.querySelector("footer");
  const footer = {
    text: clean(footerEl?.querySelector("p, small")?.textContent ?? footerEl?.textContent, 200),
    links: [...new Set([...(footerEl?.querySelectorAll("a") ?? [])].map((a) => clean(a.textContent, 40)).filter(Boolean))].slice(0, 8),
  };

  const root = doc.querySelector("main") ?? doc.body;
  const items: OutlineItem[] = [];
  const taken: Element[] = [];
  const inside = (el: Element, sel: string) => !!el.closest(sel);
  const push = (item: OutlineItem) => {
    const prev = items[items.length - 1];
    if (prev && prev.kind === item.kind && prev.text === item.text && prev.src === item.src) return;
    if (items.length < MAX_ITEMS) items.push(item);
  };

  for (const el of root ? [...root.querySelectorAll("h1, h2, h3, h4, p, li, blockquote, img, button, a, form, input, textarea, select")] : []) {
    if (inside(el, SKIP) || footerEl?.contains(el)) continue;
    // <header> só com logo e menu fica de fora; com <h1> é o hero da página.
    const header = el.closest("header");
    if (header && !header.querySelector("h1")) continue;
    if (taken.some((t) => t.contains(el))) continue;
    const tag = el.tagName.toLowerCase();

    if (tag === "img") {
      const src = el.getAttribute("src") ?? "";
      if (isHttpUrl(src)) push({ kind: "img", text: clean(el.getAttribute("alt"), 120), src });
      continue;
    }
    if (tag === "form") {
      taken.push(el);
      for (const f of el.querySelectorAll("input, textarea, select")) {
        const text = fieldLabel(f, el);
        if (text) push({ kind: "field", text });
      }
      const submit = el.querySelector("button, input[type=submit]");
      const cta = clean(submit?.textContent || submit?.getAttribute("value"), 40);
      if (cta) push({ kind: "button", text: cta });
      continue;
    }
    if (tag === "input" || tag === "textarea" || tag === "select") {
      // Campo fora de <form> (sites com JS, ou o HTML que o próprio Studio exporta).
      const text = fieldLabel(el, doc);
      if (text) push({ kind: "field", text });
      continue;
    }
    if (tag === "button" || (tag === "a" && (BUTTONISH.test(el.getAttribute("class") ?? "") || el.getAttribute("role") === "button"))) {
      const text = clean(el.textContent, 40);
      if (text) push({ kind: "button", text });
      taken.push(el);
      continue;
    }
    if (tag === "a") continue; // links comuns ficam no texto do parágrafo

    const text = clean(el.textContent);
    if (!text) continue;
    taken.push(el);
    if (tag === "h1") push({ kind: "h1", text });
    else if (tag === "h2") push({ kind: "h2", text });
    else if (tag === "h3" || tag === "h4") push({ kind: "h3", text });
    else if (tag === "li") push({ kind: "li", text });
    else push({ kind: "p", text });
  }

  return { file, title, brand, nav, items, footer };
}

// ---------------- esboço -> rascunho, sem IA ----------------

function node(type: Parameters<typeof createNode>[0], props: Record<string, string>): DraftNode {
  const n = createNode(type);
  // Campos de texto começam vazios: os padrões do bloco seriam conteúdo inventado.
  n.props = { ...Object.fromEntries(Object.entries(n.props).map(([k, v]) => [k, /variant|tone|level|icon/.test(k) ? v : ""])), ...props };
  if (n.children) n.children = [];
  return n;
}

/** Converte o esboço de uma página em blocos: navbar, hero, uma seção por h2, form, footer. */
export function outlineToDraft(o: PageOutline, opts: { navLinks?: string[]; year?: number } = {}): DraftNode[] {
  const items = [...o.items];
  const out: DraftNode[] = [];
  const firstButton = items.find((i) => i.kind === "button")?.text ?? "";
  out.push(node("navbar", { brand: o.brand, links: (opts.navLinks ?? o.nav).join("\n"), cta: o.nav.length ? "" : firstButton }));

  // Hero: o primeiro h1 e o que vem logo depois dele (até o próximo título).
  const h1 = items.findIndex((i) => i.kind === "h1");
  if (h1 >= 0) {
    const end = items.findIndex((i, k) => k > h1 && (i.kind === "h1" || i.kind === "h2"));
    const span = items.splice(h1, (end < 0 ? items.length : end) - h1);
    const [title, ...rest] = span;
    const sub = rest.find((i) => i.kind === "p");
    const cta = rest.find((i) => i.kind === "button");
    const img = rest.find((i) => i.kind === "img");
    out.push(node("hero", { title: title.text, subtitle: sub?.text ?? "", cta: cta?.text ?? "", image: img?.src ?? "" }));
    // O que sobrou do trecho do hero (outros parágrafos) vira a primeira seção.
    items.unshift(...rest.filter((i) => i !== sub && i !== cta && i !== img));
  }

  let section: DraftNode | null = null;
  let list: string[] = [];
  let fields: string[] = [];
  let formTitle = "";
  const flushList = () => {
    if (list.length && section) section.children!.push(node("text", { text: list.map((l) => `• ${l}`).join("\n") }));
    list = [];
  };
  const closeSection = () => {
    flushList();
    if (section && section.children!.length) out.push(section);
    section = null;
  };
  const ensureSection = () => (section ??= node("section", {}));
  /** Formulário é bloco de página: fecha a seção. Seção só com o título vira o título do form. */
  const pushForm = (cta: string) => {
    flushList();
    const only = section?.children ?? [];
    if (only.length === 1 && only[0].type === "heading") {
      formTitle = only[0].props.text;
      section = null;
    }
    closeSection();
    out.push(node("form", { title: formTitle, fields: fields.join("\n"), cta }));
    fields = [];
  };

  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.kind !== "li") flushList();
    if (it.kind === "field") {
      fields.push(it.text);
      // Botão logo depois dos campos é o envio do formulário.
      if (items[k + 1]?.kind === "button" && items[k + 2]?.kind !== "field") {
        k++;
        pushForm(items[k].text);
      }
      continue;
    }
    if (it.kind === "h1" || it.kind === "h2") {
      closeSection();
      formTitle = it.text;
      ensureSection().children!.push(node("heading", { text: it.text, level: it.kind === "h1" ? "1" : "2" }));
    } else if (it.kind === "h3") ensureSection().children!.push(node("heading", { text: it.text, level: "3" }));
    else if (it.kind === "p") ensureSection().children!.push(node("text", { text: it.text }));
    else if (it.kind === "li") {
      ensureSection();
      list.push(it.text);
    } else if (it.kind === "button") ensureSection().children!.push(node("button", { label: it.text }));
    else if (it.kind === "img") ensureSection().children!.push(node("image", { url: it.src ?? "", alt: it.text }));
  }
  if (fields.length) pushForm("Enviar");
  closeSection();

  const year = opts.year ?? new Date().getFullYear();
  out.push(node("footer", { text: o.footer.text || `© ${year} ${o.brand}`.trim(), links: o.footer.links.join("\n") }));
  return out;
}

/** Site inteiro sem IA: o menu de todas as páginas lista as páginas importadas. */
export function outlinesToSite(outlines: PageOutline[]): { name: string; tree: DraftNode[] }[] {
  const names = outlines.map((o) => pageNameFromFile(o.file, o.title));
  const navLinks = outlines.length > 1 ? names : undefined;
  return outlines.map((o, i) => ({ name: names[i], tree: outlineToDraft(o, { navLinks }) }));
}

/** Esboço em texto compacto para a IA (uma linha por item). */
export function outlineToPrompt(o: PageOutline, maxChars = 6000): string {
  const lines = [`# Página: ${pageNameFromFile(o.file, o.title)} (arquivo ${o.file})`, `Título: ${o.title}`, `Marca: ${o.brand}`];
  if (o.nav.length) lines.push(`Menu: ${o.nav.join(" | ")}`);
  for (const i of o.items) lines.push(i.kind === "img" ? `IMG: ${i.src}${i.text ? ` (${i.text})` : ""}` : `${i.kind.toUpperCase()}: ${i.text}`);
  if (o.footer.text || o.footer.links.length) lines.push(`Rodapé: ${o.footer.text}${o.footer.links.length ? ` | links: ${o.footer.links.join(", ")}` : ""}`);
  const text = lines.join("\n");
  return text.length > maxChars ? text.slice(0, maxChars) + "\n[…conteúdo cortado]" : text;
}
