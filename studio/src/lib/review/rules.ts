// Revisão sem IA: regras rápidas para o grafo de arquitetura e o diagrama ER.
import { ARCH, authMode, routeLines, type ArchGraph } from "@/lib/arch/model";
import { fkColumns, pkOf, snake, type ErModel } from "@/lib/db/model";

export type Severity = "error" | "warning" | "info";
export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  targetId?: string;
}

export function reviewArch(g: ArchGraph, er?: ErModel): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const degree = (id: string) => g.edges.filter((e) => e.source === id || e.target === id).length;

  for (const n of g.nodes) {
    if (degree(n.id) === 0 && g.nodes.length > 1) out.push({ code: "A01", severity: "warning", message: `"${n.name}" não está ligado a nada.`, targetId: n.id });
    if ((n.kind === "api" || n.kind === "service") && routeLines(n.props.routes).filter((r) => r.path !== "/health").length === 0) {
      out.push({ code: "A02", severity: "info", message: `"${n.name}" só tem /health. Descreva as rotas no painel.`, targetId: n.id });
    }
    if (n.kind === "worker" && !g.edges.some((e) => e.target === n.id && byId.get(e.source)?.kind === "queue")) {
      out.push({ code: "A03", severity: "warning", message: `Worker "${n.name}" não consome nenhuma fila (ligue Fila → Worker).`, targetId: n.id });
    }
    if (n.kind === "queue") {
      const producers = g.edges.filter((e) => e.target === n.id).length;
      const consumers = g.edges.filter((e) => e.source === n.id).length;
      if (!producers) out.push({ code: "A04", severity: "warning", message: `Ninguém publica na fila "${n.name}".`, targetId: n.id });
      if (!consumers) out.push({ code: "A05", severity: "warning", message: `Ninguém consome a fila "${n.name}".`, targetId: n.id });
    }
    if (n.kind === "postgres") {
      const users = g.edges.filter((e) => e.target === n.id).map((e) => byId.get(e.source)).filter(Boolean);
      if (users.length > 1) out.push({ code: "A06", severity: "info", message: `"${n.name}" é usado por ${users.length} serviços. Banco compartilhado acopla os serviços.`, targetId: n.id });
      if (er && er.tables.length === 0) out.push({ code: "A07", severity: "info", message: "O banco não tem tabelas: desenhe-as no modo Banco para gerar schema e CRUD.", targetId: n.id });
    }
  }
  for (const e of g.edges) {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) {
      out.push({ code: "A10", severity: "error", message: "Ligação aponta para um bloco que não existe mais.", targetId: e.id });
      continue;
    }
    if (s.kind === "web" && ["postgres", "cache", "queue", "storage"].includes(t.kind)) {
      out.push({ code: "A11", severity: "error", message: `O site acessa "${t.name}" direto. Passe por uma API.`, targetId: e.id });
    }
    if (["postgres", "cache", "storage", "external", "auth"].includes(s.kind) && e.kind !== "event") {
      out.push({ code: "A12", severity: "warning", message: `"${s.name}" (${ARCH[s.kind].label}) não inicia chamadas. Inverta a ligação.`, targetId: e.id });
    }
  }
  // Ciclo de chamadas HTTP síncronas.
  const http = g.edges.filter((e) => e.kind === "http");
  const visit = (id: string, path: string[]): string[] | null => {
    if (path.includes(id)) return [...path, id];
    for (const e of http.filter((x) => x.source === id)) {
      const c = visit(e.target, [...path, id]);
      if (c) return c;
    }
    return null;
  };
  for (const n of g.nodes) {
    const cycle = visit(n.id, []);
    if (cycle) {
      out.push({ code: "A13", severity: "warning", message: `Chamadas HTTP em ciclo: ${cycle.map((id) => byId.get(id)?.name).join(" → ")}.` });
      break;
    }
  }
  for (const n of g.nodes.filter((x) => x.kind === "api" || x.kind === "service")) {
    const outgoing = g.edges.filter((e) => e.source === n.id);
    const auth = outgoing.map((e) => byId.get(e.target)).find((t) => t?.kind === "auth");
    const writesPg = outgoing.some((e) => e.kind === "writes" && byId.get(e.target)?.kind === "postgres");
    if (auth && authMode(auth) === "propria" && !writesPg) {
      out.push({ code: "A15", severity: "error", message: `"${n.name}" usa Autenticação própria, mas não grava no Postgres. Ligue ${n.name} → Banco (grava).`, targetId: n.id });
    }
    if (!auth && routeLines(n.props.routes).some((r) => r.protected)) {
      out.push({ code: "A16", severity: "info", message: `"${n.name}" tem rotas com auth sem bloco de Autenticação ligado: o token é validado só com JWT_SECRET.`, targetId: n.id });
    }
  }
  const publicApi = g.nodes.some((n) => n.kind === "api");
  if (publicApi && !g.nodes.some((n) => n.kind === "auth")) {
    out.push({ code: "A14", severity: "info", message: "Nenhum bloco de Autenticação. Se houver área logada, adicione um." });
  }
  return out;
}

const RESERVED = new Set(["user", "order", "group", "select", "table", "where", "from", "limit", "offset", "default", "check", "column", "index", "key", "desc", "asc"]);

export function reviewDb(m: ErModel): Finding[] {
  const out: Finding[] = [];
  const names = new Map<string, number>();
  for (const t of m.tables) names.set(snake(t.name), (names.get(snake(t.name)) ?? 0) + 1);
  const fks = fkColumns(m);

  for (const t of m.tables) {
    const tn = snake(t.name);
    if ((names.get(tn) ?? 0) > 1) out.push({ code: "D01", severity: "error", message: `Duas tabelas se chamam "${tn}".`, targetId: t.id });
    if (!pkOf(t)) out.push({ code: "D02", severity: "error", message: `"${t.name}" não tem chave primária.`, targetId: t.id });
    if (t.columns.length === 0) out.push({ code: "D03", severity: "error", message: `"${t.name}" não tem colunas.`, targetId: t.id });
    if (RESERVED.has(tn)) out.push({ code: "D04", severity: "warning", message: `"${tn}" é palavra reservada em SQL. Prefira o plural (ex.: users, orders).`, targetId: t.id });
    if (t.name !== tn) out.push({ code: "D05", severity: "info", message: `"${t.name}" vira "${tn}" no SQL (snake_case).`, targetId: t.id });
    const cols = new Map<string, number>();
    for (const c of t.columns) cols.set(snake(c.name), (cols.get(snake(c.name)) ?? 0) + 1);
    for (const [c, n] of cols) if (n > 1) out.push({ code: "D06", severity: "error", message: `Coluna "${c}" repetida em "${t.name}".`, targetId: t.id });
    for (const fk of fks.filter((f) => f.table.id === t.id)) {
      if (cols.has(fk.name)) out.push({ code: "D07", severity: "error", message: `"${t.name}" já tem uma coluna "${fk.name}", que a relação com "${fk.ref.name}" também cria. Apague a coluna manual.`, targetId: t.id });
      if (!pkOf(fk.ref)) out.push({ code: "D08", severity: "error", message: `"${t.name}" referencia "${fk.ref.name}", que não tem chave primária.`, targetId: t.id });
    }
    const related = m.relations.some((r) => r.from === t.id || r.to === t.id);
    if (!related && m.tables.length > 1) out.push({ code: "D09", severity: "info", message: `"${t.name}" não se relaciona com outras tabelas.`, targetId: t.id });
    if (!t.columns.some((c) => c.type === "timestamp" && /created/.test(c.name))) {
      out.push({ code: "D10", severity: "info", message: `"${t.name}" não tem created_at. Costuma ajudar em auditoria.`, targetId: t.id });
    }
  }
  return out;
}
