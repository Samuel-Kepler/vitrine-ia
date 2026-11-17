// Sugestão determinística de arquitetura + banco a partir da landing.
// É o "modelo mock" do botão Sugerir e o plano B quando a IA falha.
import type { DraftNode } from "@/lib/draft/tree";
import { lines } from "@/lib/draft/tree";
import { slug } from "@/lib/draft/to-express";
import type { ColType } from "@/lib/db/model";
import type { ArchEdgeKind, ArchKind } from "@/lib/arch/model";

/** Formato compacto (sem ids nem posições) que a IA também devolve. */
export interface CompactArch {
  nodes: { key: string; kind: ArchKind; name: string; routes?: string[] }[];
  edges: { from: string; to: string; kind: ArchEdgeKind }[];
}
export interface CompactDb {
  tables: { name: string; columns: { name: string; type: ColType; pk?: boolean; nullable?: boolean; unique?: boolean; default?: string }[] }[];
  relations: { from: string; to: string; kind: "n-1" | "1-1" | "n-n" }[];
}
export interface Suggestion {
  arch: CompactArch;
  db: CompactDb;
  notes: string[];
}

function walk(tree: DraftNode[]): DraftNode[] {
  return tree.flatMap((n) => [n, ...walk(n.children ?? [])]);
}

const ID = { name: "id", type: "uuid" as ColType, pk: true, default: "uuid" };
const CREATED = { name: "created_at", type: "timestamp" as ColType, default: "now" };

function fieldType(label: string): { type: ColType; unique?: boolean } {
  const s = slug(label);
  if (/mail/.test(s)) return { type: "varchar", unique: false };
  if (/telefone|whats|celular|phone/.test(s)) return { type: "varchar" };
  if (/idade|quantidade|qtd|numero/.test(s)) return { type: "int" };
  if (/data|nascimento/.test(s)) return { type: "date" };
  if (/mensagem|descricao|comentario|obs/.test(s)) return { type: "text" };
  return { type: "varchar" };
}

// Palavras inteiras: "conta" não pode casar dentro de "Contato". \b do JS só
// entende ASCII (falha em "área"), então os limites são feitos com \p{L}.
const WANTS_LOGIN = /(?<!\p{L})(login|entrar|conta|contas|cadastro|cadastre-se|minha [aá]rea|[aá]rea do cliente)(?!\p{L})/u;

export function inferFromDraft(draft: DraftNode[], brief = ""): Suggestion {
  const all = walk(draft);
  const has = (t: DraftNode["type"]) => all.some((n) => n.type === t);
  const text = (all.map((n) => Object.values(n.props).join(" ")).join(" ") + " " + brief).toLowerCase();
  const brand = all.find((n) => n.type === "navbar")?.props.brand ?? "App";

  const arch: CompactArch = { nodes: [], edges: [] };
  const db: CompactDb = { tables: [], relations: [] };
  const notes: string[] = [];
  const routes: string[] = ["GET /health"];

  arch.nodes.push({ key: "site", kind: "web", name: `Site ${brand}` });
  arch.nodes.push({ key: "api", kind: "api", name: "API", routes });
  arch.edges.push({ from: "site", to: "api", kind: "http" });

  const forms = all.filter((n) => n.type === "form");
  if (forms.length) {
    const fields = [...new Set(forms.flatMap((f) => lines(f.props.fields)))];
    db.tables.push({
      name: "leads",
      columns: [ID, ...fields.map((f) => ({ name: slug(f).replace(/^e_?mail$/, "email"), ...fieldType(f) })), { name: "origem", type: "varchar" as ColType, nullable: true }, CREATED],
    });
    routes.push("POST /leads", "GET /leads");
    notes.push(`Formulário → tabela leads (${fields.join(", ")}) e POST /leads.`);
    arch.nodes.push({ key: "fila", kind: "queue", name: "Eventos" }, { key: "notif", kind: "worker", name: "Notificações" }, { key: "email", kind: "external", name: "Serviço de e-mail" });
    arch.edges.push({ from: "api", to: "fila", kind: "event" }, { from: "fila", to: "notif", kind: "event" }, { from: "notif", to: "email", kind: "http" });
    notes.push("Novo lead publica um evento; o worker Notificações avisa por e-mail.");
  }

  if (has("pricing")) {
    db.tables.push(
      { name: "plans", columns: [ID, { name: "name", type: "varchar", unique: true }, { name: "price", type: "decimal" }, { name: "active", type: "boolean", default: "true" }] },
      { name: "subscriptions", columns: [ID, { name: "email", type: "varchar" }, { name: "status", type: "varchar", default: "pending" }, CREATED] },
    );
    db.relations.push({ from: "subscriptions", to: "plans", kind: "n-1" });
    routes.push("GET /plans", "POST /subscriptions");
    arch.nodes.push({ key: "pagamentos", kind: "external", name: "Pagamentos" });
    arch.edges.push({ from: "api", to: "pagamentos", kind: "http" });
    notes.push("Planos → tabelas plans e subscriptions, mais a API externa de Pagamentos.");
  }

  if (has("testimonial")) {
    db.tables.push({ name: "testimonials", columns: [ID, { name: "quote", type: "text" }, { name: "author", type: "varchar" }, { name: "role", type: "varchar", nullable: true }, { name: "published", type: "boolean", default: "false" }, CREATED] });
    routes.push("GET /testimonials");
    notes.push("Depoimentos → tabela testimonials, editável sem novo deploy.");
  }

  if (WANTS_LOGIN.test(text)) {
    // Mesmo formato que ensureAuthUsers (auth "Própria", o padrão do bloco).
    db.tables.push({ name: "users", columns: [ID, { name: "email", type: "varchar", unique: true }, { name: "password_hash", type: "text" }, { name: "name", type: "varchar", nullable: true }, CREATED] });
    arch.nodes.push({ key: "auth", kind: "auth", name: "Login" });
    arch.edges.push({ from: "api", to: "auth", kind: "http" });
    if (db.tables.some((t) => t.name === "subscriptions")) {
      db.relations.push({ from: "subscriptions", to: "users", kind: "n-1" });
      const i = routes.indexOf("POST /subscriptions");
      if (i >= 0) routes[i] = "POST /subscriptions auth";
    }
    notes.push("O texto fala em login/conta → Autenticação própria (register/login/me com JWT) e tabela users com password_hash.");
  }

  if (has("image") || /foto|upload|arquivo|cardápio em pdf/.test(text)) {
    arch.nodes.push({ key: "arquivos", kind: "storage", name: "Arquivos" });
    arch.edges.push({ from: "api", to: "arquivos", kind: "writes" });
  }

  if (db.tables.length) {
    arch.nodes.push({ key: "db", kind: "postgres", name: "Banco" });
    arch.edges.push({ from: "api", to: "db", kind: "writes" });
  } else {
    notes.push("A landing não tem formulário, planos nem depoimentos: o backend fica só com a API.");
  }
  return { arch, db, notes };
}
