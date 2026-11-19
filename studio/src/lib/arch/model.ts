// Modelo do canvas de arquitetura (IR). O canvas guarda posição; os
// geradores e a revisão só olham kind/nome/props/arestas.
import { z } from "zod";

export const ARCH_KINDS = ["web", "api", "service", "worker", "queue", "cache", "postgres", "storage", "external", "auth"] as const;
export type ArchKind = (typeof ARCH_KINDS)[number];

export const EDGE_KINDS = ["http", "event", "reads", "writes"] as const;
export type ArchEdgeKind = (typeof EDGE_KINDS)[number];

export interface ArchNode {
  id: string;
  kind: ArchKind;
  name: string;
  props: Record<string, string>;
  position: { x: number; y: number };
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  kind: ArchEdgeKind;
}

export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface ArchFieldDef {
  key: string;
  label: string;
  kind: "text" | "lines" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Só mostra o campo quando outra prop tem este valor. */
  showIf?: { key: string; value: string };
  help?: string;
}

const ROUTES_FIELD: ArchFieldDef = {
  key: "routes",
  label: "Rotas (MÉTODO /caminho [auth])",
  kind: "lines",
  placeholder: "GET /leads\nPOST /leads\nPOST /subscriptions auth",
  help: "Termine a linha com auth (ou 🔒) para exigir token JWT nessa rota.",
};

export interface ArchKindDef {
  kind: ArchKind;
  label: string;
  hint: string;
  color: string;
  /** Vira um serviço com código gerado. */
  runnable: boolean;
  defaults: Record<string, string>;
  fields: ArchFieldDef[];
}

export const ARCH: Record<ArchKind, ArchKindDef> = {
  web: { kind: "web", label: "Site / Front", hint: "A landing ou app no navegador", color: "#0ea5e9", runnable: false, defaults: {}, fields: [] },
  api: {
    kind: "api",
    label: "API",
    hint: "HTTP público (Hono)",
    color: "#6366f1",
    runnable: true,
    defaults: { routes: "GET /health", port: "" },
    fields: [ROUTES_FIELD, { key: "port", label: "Porta", kind: "text", placeholder: "automática" }],
  },
  service: {
    kind: "service",
    label: "Serviço",
    hint: "HTTP interno (Hono)",
    color: "#8b5cf6",
    runnable: true,
    defaults: { routes: "GET /health", port: "" },
    fields: [ROUTES_FIELD, { key: "port", label: "Porta", kind: "text", placeholder: "automática" }],
  },
  worker: { kind: "worker", label: "Worker", hint: "Consome uma fila", color: "#a855f7", runnable: true, defaults: {}, fields: [] },
  queue: {
    kind: "queue",
    label: "Fila",
    hint: "Eventos (Redis Streams)",
    color: "#f59e0b",
    runnable: false,
    defaults: { stream: "" },
    fields: [{ key: "stream", label: "Nome do stream", kind: "text", placeholder: "igual ao nome" }],
  },
  cache: { kind: "cache", label: "Cache", hint: "Redis", color: "#ef4444", runnable: false, defaults: {}, fields: [] },
  postgres: {
    kind: "postgres",
    label: "Banco Postgres",
    hint: "Tabelas vêm do canvas Banco",
    color: "#10b981",
    runnable: false,
    defaults: { database: "app" },
    fields: [{ key: "database", label: "Nome do banco", kind: "text" }],
  },
  storage: {
    kind: "storage",
    label: "Arquivos",
    hint: "S3 (RustFS)",
    color: "#14b8a6",
    runnable: false,
    defaults: { bucket: "uploads" },
    fields: [{ key: "bucket", label: "Bucket", kind: "text" }],
  },
  external: {
    kind: "external",
    label: "API externa",
    hint: "Pagamento, e-mail, CRM…",
    color: "#64748b",
    runnable: false,
    defaults: { url: "https://api.exemplo.com" },
    fields: [{ key: "url", label: "URL base", kind: "text" }],
  },
  auth: {
    kind: "auth",
    label: "Autenticação",
    hint: "Login com JWT: própria (gerada na API) ou externa",
    color: "#f43f5e",
    runnable: false,
    defaults: { mode: "propria", issuer: "https://auth.exemplo.com" },
    fields: [
      {
        key: "mode",
        label: "Tipo",
        kind: "select",
        options: [
          { value: "propria", label: "Própria (gera na API ligada)" },
          { value: "externa", label: "Externa (cliente HTTP)" },
        ],
        help: "Própria: tabela users (email único + password_hash), POST /auth/register, POST /auth/login e GET /auth/me com JWT.",
      },
      { key: "issuer", label: "URL do provedor (issuer)", kind: "text", showIf: { key: "mode", value: "externa" } },
    ],
  },
};

export const EDGE_LABELS: Record<ArchEdgeKind, string> = { http: "HTTP", event: "evento", reads: "lê", writes: "grava" };

/** Tipo de aresta mais provável ao ligar source -> target. */
export function defaultEdgeKind(source: ArchKind, target: ArchKind): ArchEdgeKind {
  if (target === "queue" || source === "queue") return "event";
  if (["postgres", "cache", "storage"].includes(target)) return "writes";
  return "http";
}

export const ArchGraphSchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        kind: z.enum(ARCH_KINDS),
        name: z.string().max(80),
        props: z.record(z.string().max(4000)),
        position: z.object({ x: z.number(), y: z.number() }),
      }),
    )
    .max(100),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), kind: z.enum(EDGE_KINDS) })).max(300),
});

export type AuthMode = "propria" | "externa";
/** Nós antigos (sem "mode") contam como Própria, o padrão. */
export function authMode(n: Pick<ArchNode, "props">): AuthMode {
  return n.props.mode === "externa" ? "externa" : "propria";
}

/** Algum serviço HTTP está ligado a uma Autenticação Própria (precisa de users no ER). */
export function usesOwnAuth(g: ArchGraph): boolean {
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return g.edges.some((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    return !!s && !!t && (s.kind === "api" || s.kind === "service") && t.kind === "auth" && authMode(t) === "propria";
  });
}

export interface RouteLine {
  method: string;
  path: string;
  /** Linha terminada em "auth" ou "🔒": exige JWT. */
  protected: boolean;
}

export function routeLines(routes: string | undefined): RouteLine[] {
  return (routes ?? "")
    .split("\n")
    .map((l) => l.trim().match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*?)(?:\s*(🔒)|\s+(auth))?$/iu))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ method: m[1].toUpperCase(), path: m[2], protected: !!(m[3] || m[4]) }));
}
