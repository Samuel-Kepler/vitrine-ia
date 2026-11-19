/**
 * Sanitização do HTML exportado da landing.
 *
 * O conteúdo vem da IA (textos, links, imagens). O React já escapa texto e
 * bloqueia `javascript:` em href, mas não checa `data:`, `vbscript:`, `src`,
 * nem `url()` em estilos. Aqui a saída é limpa antes de virar arquivo, e o
 * <head> recebe uma CSP que proíbe scripts na página exportada.
 */

import { isSafeLinkUrl, isSafeMediaUrl } from "@/lib/security/url";

export { isSafeLinkUrl, isSafeMediaUrl };

const DROP_ELEMENTS = "script, iframe, object, embed, base, frame, frameset, applet, meta, link, noscript";
const LINK_ATTRS = ["href", "action", "formaction", "xlink:href"];
const MEDIA_ATTRS = ["src", "poster", "background"];

/** Remove declarações de estilo com url() inseguro ou expression(). */
function sanitizeStyle(style: string): string {
  return style
    .split(";")
    .filter((decl) => {
      if (/expression\s*\(|behavior\s*:|-moz-binding/i.test(decl)) return false;
      const urls = [...decl.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map((m) => m[2]);
      return urls.every(isSafeMediaUrl);
    })
    .join(";");
}

function sanitizeElement(el: Element) {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value;
    if (name.startsWith("on") || name === "srcdoc") {
      el.removeAttribute(attr.name);
    } else if (LINK_ATTRS.includes(name)) {
      if (!isSafeLinkUrl(value)) el.setAttribute(attr.name, "#");
    } else if (MEDIA_ATTRS.includes(name)) {
      if (!isSafeMediaUrl(value)) el.removeAttribute(attr.name);
    } else if (name === "srcset") {
      const ok = value.split(",").every((part) => isSafeMediaUrl(part.trim().split(/\s+/)[0] ?? ""));
      if (!ok) el.removeAttribute(attr.name);
    } else if (name === "style") {
      const clean = sanitizeStyle(value);
      if (clean !== value) el.setAttribute("style", clean);
    }
  }
  // Link para fora abre em nova aba sem dar acesso a window.opener.
  if (el.tagName === "A" && el.getAttribute("target") === "_blank") {
    el.setAttribute("rel", "noopener noreferrer");
  }
}

/** Limpa uma árvore, inclusive o conteúdo de <template> (declarative shadow DOM). */
function sanitizeTree(root: ParentNode) {
  root.querySelectorAll(DROP_ELEMENTS).forEach((el) => el.remove());
  root.querySelectorAll("*").forEach((el) => {
    sanitizeElement(el);
    if (el instanceof HTMLTemplateElement) sanitizeTree(el.content);
  });
}

/**
 * Recebe o HTML do <body> (pode conter <template shadowrootmode>) e devolve
 * a versão limpa. DOMParser não executa scripts nem anexa shadow roots, então
 * os templates continuam templates e são serializados de volta intactos.
 */
export function sanitizeBodyHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, "text/html");
  sanitizeTree(doc.body);
  return doc.body.innerHTML;
}

/** CSS vai dentro de <style>: impede que feche a tag e injete HTML. */
export function sanitizeCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * CSP da página exportada: sem scripts, sem frames, sem envio de formulário.
 * Estilos inline são necessários (o export embute o CSS); fontes do Google.
 */
export const EXPORT_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src https: http: data:",
  "form-action 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
].join("; ");
