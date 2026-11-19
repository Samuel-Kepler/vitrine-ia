// Várias páginas no mesmo site. A página aberta vive em `tree`/`result` do
// store (as telas antigas continuam iguais); `pages` guarda todas, e a entrada
// da página aberta só é atualizada ao trocar de página (commitActive).
// Menu (navbar) e rodapé (footer) do topo da página são compartilhados.
import type { ReimagineResult } from "@/lib/reimagine/reimagine";
import { slug } from "./to-express";
import { createNode, type DraftNode } from "./tree";

export interface Page {
  id: string;
  name: string;
  slug: string;
  tree: DraftNode[];
  result: ReimagineResult | null;
}

export const HOME_ID = "p_home";

export function homePage(tree: DraftNode[] = [], result: ReimagineResult | null = null): Page {
  return { id: HOME_ID, name: "Início", slug: "inicio", tree, result };
}

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Slug único entre as páginas (cardapio, cardapio-2…). */
export function uniqueSlug(name: string, pages: Pick<Page, "id" | "slug">[], selfId?: string): string {
  const base = slug(name) || "pagina";
  const taken = new Set(pages.filter((p) => p.id !== selfId).map((p) => p.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export interface Chrome {
  navbar?: DraftNode;
  footer?: DraftNode;
}

export function chromeOf(tree: DraftNode[]): Chrome {
  return { navbar: tree.find((n) => n.type === "navbar"), footer: tree.find((n) => n.type === "footer") };
}

/** Troca (ou insere) o menu no topo e o rodapé no fim da página. */
export function applyChrome(tree: DraftNode[], chrome: Chrome): DraftNode[] {
  let out = tree;
  for (const kind of ["navbar", "footer"] as const) {
    const node = chrome[kind];
    if (!node) continue;
    const i = out.findIndex((n) => n.type === kind);
    if (i >= 0) {
      if (out[i] === node) continue;
      out = out.map((n, k) => (k === i ? node : n));
    } else {
      out = kind === "navbar" ? [node, ...out] : [...out, node];
    }
  }
  return out;
}

const linksOf = (n?: DraftNode) => (n?.props.links ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

function setLinks(tree: DraftNode[], f: (links: string[]) => string[]): DraftNode[] {
  return tree.map((n) => (n.type === "navbar" ? { ...n, props: { ...n.props, links: f(linksOf(n)).join("\n") } } : n));
}

/** Garante um link do menu para a página (sem duplicar, ignorando acento e caixa). */
export function addLink(tree: DraftNode[], name: string): DraftNode[] {
  return setLinks(tree, (ls) => (ls.some((l) => norm(l) === norm(name)) ? ls : [...ls, name]));
}

export function renameLink(tree: DraftNode[], from: string, to: string): DraftNode[] {
  return setLinks(tree, (ls) => ls.map((l) => (norm(l) === norm(from) ? to : l)));
}

export function removeLink(tree: DraftNode[], name: string): DraftNode[] {
  return setLinks(tree, (ls) => ls.filter((l) => norm(l) !== norm(name)));
}

/** Página nova: menu e rodapé compartilhados + uma seção com o título. */
export function newPageTree(name: string, chrome: Chrome): DraftNode[] {
  const section = createNode("section");
  const h = createNode("heading");
  h.props = { ...h.props, text: name, level: "1" };
  section.children = [h];
  return applyChrome([section], chrome);
}

/** Link do menu clicado no preview -> página com esse nome (ou slug). */
export function pageForLink(pages: Page[], text: string): Page | undefined {
  const t = norm(text);
  if (!t) return undefined;
  return pages.find((p) => norm(p.name) === t || p.slug === slug(text));
}

/** Grava a página aberta na lista e espalha o menu/rodapé dela por todas. */
export function commitActive(pages: Page[], activeId: string, tree: DraftNode[], result: ReimagineResult | null): Page[] {
  const chrome = chromeOf(tree);
  return pages.map((p) => (p.id === activeId ? { ...p, tree, result } : { ...p, tree: applyChrome(p.tree, chrome) }));
}

/** Estado salvo da v1 (uma página só) -> v2: ela vira a "Início". */
export function migrateStudio(persisted: unknown, version: number): Record<string, unknown> {
  const st = (persisted ?? {}) as Record<string, unknown>;
  if (version >= 2) return st;
  return { ...st, pages: [homePage((st.tree as DraftNode[]) ?? [], (st.result as ReimagineResult | null) ?? null)], pageId: HOME_ID };
}

/** Arquivo da página no site exportado: a primeira é index.html. */
export function pageFile(pages: Pick<Page, "id" | "slug">[], id: string): string {
  const i = pages.findIndex((p) => p.id === id);
  return i <= 0 ? "index.html" : `${pages[i].slug}.html`;
}

/** O site inteiro como um rascunho só (menu, miolo de cada página, rodapé), para o Sugerir. */
export function siteDraft(pages: Page[]): DraftNode[] {
  const first = pages[0]?.tree ?? [];
  const { navbar, footer } = chromeOf(first);
  const bodies = pages.flatMap((p) => p.tree.filter((n) => n.type !== "navbar" && n.type !== "footer"));
  return [...(navbar ? [navbar] : []), ...bodies, ...(footer ? [footer] : [])];
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();

/** No HTML exportado, liga os links do menu/rodapé com nome de página ao arquivo dela. */
export function linkPagesInHtml(html: string, pages: Pick<Page, "id" | "name" | "slug">[]): string {
  return html.replace(/<a\b([^>]*?)\bhref="#"([^>]*)>([\s\S]*?)<\/a>/g, (m, pre: string, post: string, inner: string) => {
    const page = pageForLink(pages as Page[], stripTags(inner));
    return page ? `<a${pre}href="${pageFile(pages, page.id)}"${post}>${inner}</a>` : m;
  });
}
