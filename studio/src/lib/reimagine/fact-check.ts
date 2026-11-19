// Aviso sem IA: depois de validar o A2UI, procura na página números e nomes
// próprios que não estavam no rascunho nem no briefing. Só avisa; não muda a página.
import type { DraftNode } from "@/lib/draft/tree";

export interface FactFinding {
  kind: "número" | "nome";
  value: string;
  /** Trecho da página onde apareceu. */
  context: string;
}

const MAX_FINDINGS = 12;

// Chaves de props que não são texto visível (ids, enums, bindings).
const SKIP_KEYS = new Set(["id", "component", "child", "children", "palette", "theme", "tone", "variant", "animation", "motion", "photo", "images", "index", "level", "align", "justify", "direction", "url", "src", "href", "icon", "surfaceId", "catalogId", "version", "path", "name", "action", "event"]);

// Rótulos padrão de navegação/CTA e palavras com maiúscula comuns em landing: não são fatos.
const STANDARD = [
  "início inicio home sobre contato contatos cardápio cardapio menu preços precos planos plano depoimentos entrar login começar comecar",
  "saiba mais enviar privacidade termos uso faq blog produto produtos serviços servicos recursos benefícios beneficios equipe galeria",
  "agende reservar reserva assine comprar ver conheça conheca fale conosco nossa nosso nossos nossas por que como quem somos política politica",
  "cookies instagram whatsapp facebook linkedin youtube tiktok e-mail email nome mensagem telefone wi-fi wifi brasil todos direitos reservados",
].join(" ");

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Hífens e travessões tipográficos (‐ ‑ ‒ – — −) viram "-": "Wi‑Fi" não pode virar o nome "Fi". */
const dash = (s: string) => s.replace(/[‐-―−]/g, "-");

/** Todas as strings visíveis das mensagens A2UI (props de texto dos componentes). */
export function a2uiTexts(messages: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key?: string) => {
    if (key && SKIP_KEYS.has(key)) return;
    if (typeof v === "string") {
      // ids/identificadores e caminhos de binding não são texto visível
      if (/^[a-z0-9_]+$/.test(v) || v.startsWith("/") || /^https?:/.test(v)) return;
      out.push(dash(v));
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("@path" in o || "@call" in o) return;
      for (const [k, x] of Object.entries(o)) walk(x, k);
    }
  };
  walk(messages);
  return out;
}

function inputText(draft: DraftNode[], brief = ""): string {
  const all: string[] = [brief];
  const visit = (ns: DraftNode[]) => ns.forEach((n) => (all.push(...Object.values(n.props)), visit(n.children ?? [])));
  visit(draft);
  return dash(all.join("\n"));
}

// Número com contexto: R$, %, horário (8h, 08:00), telefone, decimal.
const NUM = /(?:R\$\s?)?\(?\d[\d.,:/\-)( ]*\d(?:\s?%|h(?:\d{2})?\b)?|(?:R\$\s?)\d|\d\s?%|\b\d{1,2}h\b/g;
const digits = (s: string) => s.replace(/\D/g, "");

// Nome próprio: sequência de palavras com inicial maiúscula (aceita "&", "de", "do"... no meio).
const CAP = "\\p{Lu}[\\p{L}\\p{M}'’-]+"; // 2+ letras: o "R" de "R$" não é nome
const NAME = new RegExp(`${CAP}(?:\\s+(?:&|e|de|do|da|dos|das)\\s+${CAP}|\\s+${CAP})*`, "gu");

export function checkFacts(messages: unknown, draft: DraftNode[], brief?: string): FactFinding[] {
  const input = inputText(draft, brief);
  const inputDigits = new Set((input.match(NUM) ?? []).map(digits).filter(Boolean));
  const inputWords = new Set(norm(input + " " + STANDARD).split(/[^\p{L}\p{M}-]+/u).filter(Boolean));
  const found = new Map<string, FactFinding>();
  const add = (f: FactFinding) => {
    const k = `${f.kind}:${norm(f.value)}`;
    if (!found.has(k)) found.set(k, f);
  };

  for (const text of a2uiTexts(messages)) {
    const context = text.length > 90 ? text.slice(0, 87) + "…" : text;
    for (const m of text.match(NUM) ?? []) {
      const d = digits(m);
      const hasMarker = /R\$|%|h|:/.test(m) || d.length >= 2;
      if (!d || !hasMarker || inputDigits.has(d)) continue;
      // aceita se cada grupo de dígitos já existia (ex.: "7h às 18h" quando a entrada tinha 7 e 18)
      const groups = m.match(/\d+/g) ?? [];
      if (groups.every((g) => inputDigits.has(g))) continue;
      add({ kind: "número", value: m.trim(), context });
    }
    for (const sentence of text.split(/(?<=[.!?:•|·—])\s+|\n+/)) {
      const s = sentence.trim();
      for (const match of s.matchAll(NAME)) {
        const name = match[0];
        const words = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
        // Palavra única no começo da frase é só maiúscula de início: não conta.
        if (words.length === 1 && match.index === 0) continue;
        const novel = words.filter((w) => !inputWords.has(norm(w)));
        if (novel.length) add({ kind: "nome", value: name, context });
      }
    }
    if (found.size >= MAX_FINDINGS) break;
  }
  return [...found.values()].slice(0, MAX_FINDINGS);
}

export function factWarnings(findings: FactFinding[]): string[] {
  return findings.map((f) => `${f.kind === "número" ? "Número" : "Nome"} novo: "${f.value}" — em “${f.context}”`);
}
