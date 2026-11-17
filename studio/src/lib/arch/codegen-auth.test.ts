import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { createNode } from "@/lib/draft/tree";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { ensureAuthUsers, type ErModel } from "@/lib/db/model";
import { toSql } from "@/lib/db/codegen";
import { archFiles } from "./codegen";
import { routeLines, usesOwnAuth, type ArchGraph } from "./model";
import { reviewArch } from "@/lib/review/rules";

function sample(brief = "clientes fazem login na área do cliente") {
  const draft = [...starterDraft(), createNode("pricing"), createNode("pricing")];
  const s = inferFromDraft(draft, brief);
  return { graph: expandArch(s.arch), er: expandDb(s.db) };
}
const file = (files: { path: string; content: string }[], p: string) => files.find((f) => f.path === p)?.content;

describe("routeLines: marcador de rota protegida", () => {
  it("aceita auth e 🔒 no fim da linha", () => {
    expect(routeLines("GET /leads\nPOST /subscriptions auth\nGET /me 🔒\nGET /x🔒\nPOST /a AUTH")).toEqual([
      { method: "GET", path: "/leads", protected: false },
      { method: "POST", path: "/subscriptions", protected: true },
      { method: "GET", path: "/me", protected: true },
      { method: "GET", path: "/x", protected: true },
      { method: "POST", path: "/a", protected: true },
    ]);
  });
  it("não confunde caminho que contém auth", () => {
    expect(routeLines("GET /auth/me")).toEqual([{ method: "GET", path: "/auth/me", protected: false }]);
  });
});

describe("ensureAuthUsers", () => {
  it("cria users com email único e password_hash", () => {
    const er = ensureAuthUsers({ tables: [], relations: [] });
    const sql = toSql(er, "postgres");
    expect(sql).toMatch(/"email" varchar\(255\) NOT NULL UNIQUE/);
    expect(sql).toMatch(/"password_hash" text NOT NULL/);
  });
  it("completa users existente e é idempotente", () => {
    const base: ErModel = { tables: [{ id: "t", name: "users", columns: [{ id: "c1", name: "id", type: "uuid", pk: true, default: "uuid" }, { id: "c2", name: "email", type: "varchar", nullable: true }], position: { x: 0, y: 0 } }], relations: [] };
    const once = ensureAuthUsers(base);
    const cols = once.tables[0].columns;
    expect(cols.find((c) => c.name === "email")).toMatchObject({ unique: true, nullable: false });
    expect(cols.some((c) => c.name === "password_hash")).toBe(true);
    expect(ensureAuthUsers(once)).toBe(once);
  });
});

describe("inferência com login", () => {
  it("gera users com password_hash e protege POST /subscriptions", () => {
    const { graph, er } = sample();
    expect(er.tables.find((t) => t.name === "users")!.columns.map((c) => c.name)).toContain("password_hash");
    expect(graph.nodes.find((n) => n.kind === "auth")!.props.mode).toBe("propria");
    expect(graph.nodes.find((n) => n.kind === "api")!.props.routes).toContain("POST /subscriptions auth");
    expect(usesOwnAuth(graph)).toBe(true);
  });
});

describe("codegen: Autenticação Própria", () => {
  const { graph, er } = sample();
  const files = archFiles(graph, er);
  const auth = file(files, "services/api/src/auth.ts")!;
  const index = file(files, "services/api/src/index.ts")!;

  it("gera register/login/me com scrypt e hono/jwt", () => {
    expect(auth).toContain('from "node:crypto"');
    expect(auth).toContain("scrypt(");
    expect(auth).toContain('import { jwt, sign } from "hono/jwt"');
    expect(auth).toContain('jwt({ secret: JWT_SECRET, alg: "HS256" })');
    expect(auth).toMatch(/authRoutes\.post\("\/register"/);
    expect(auth).toMatch(/authRoutes\.post\("\/login"/);
    expect(auth).toMatch(/authRoutes\.get\("\/me", requireAuth/);
    expect(index).toContain('app.route("/auth", authRoutes);');
    expect(JSON.parse(file(files, "services/api/package.json")!).dependencies).not.toHaveProperty("bcrypt");
  });

  it("senha nunca volta: USER_COLS sem password_hash", () => {
    const cols = auth.match(/const USER_COLS = "(.*)";/)![1];
    expect(cols).toContain('\\"email\\"');
    expect(cols).not.toContain("password_hash");
    expect(auth).toMatch(/const \{ password_hash: _hash, \.\.\.user \} = row;/);
  });

  it("aplica o middleware só nas rotas marcadas e pega o dono do token", () => {
    expect(index).toMatch(/app\.post\("\/subscriptions", requireAuth, async/);
    expect(index).toMatch(/app\.post\("\/leads", async/);
    expect(index).toContain('SubscriptionsInput.omit({ "user_id": true })');
    expect(index).toContain('["user_id", c.get("jwtPayload").sub]');
  });

  it("JWT_SECRET no compose e no .env.example; sem cliente HTTP para o Login", () => {
    expect(file(files, "docker-compose.yml")).toContain("JWT_SECRET: ${JWT_SECRET:-");
    expect(file(files, ".env.example")).toContain("JWT_SECRET=");
    expect(file(files, "services/api/src/clients.ts") ?? "").not.toContain("callLogin");
    expect(file(files, "db/schema.postgres.sql")).toMatch(/"password_hash" text NOT NULL/);
    expect(file(files, "services/api/openapi.yaml")).toContain("bearerAuth");
    expect(file(files, "README.md")).toContain("/auth/register");
  });

  it("garante users no schema mesmo se o canvas Banco não tiver a tabela", () => {
    const noUsers: ErModel = { tables: er.tables.filter((t) => t.name !== "users"), relations: er.relations.filter((r) => er.tables.find((t) => t.id === r.to)?.name !== "users") };
    expect(file(archFiles(graph, noUsers), "db/schema.postgres.sql")).toContain('CREATE TABLE "users"');
  });
});

describe("codegen: Autenticação Externa", () => {
  it("mantém o cliente HTTP e não gera /auth", () => {
    const { graph, er } = sample();
    const g: ArchGraph = { ...graph, nodes: graph.nodes.map((n) => (n.kind === "auth" ? { ...n, props: { ...n.props, mode: "externa" } } : n)) };
    const files = archFiles(g, er);
    expect(file(files, "services/api/src/clients.ts")).toContain("callLogin");
    const auth = file(files, "services/api/src/auth.ts")!; // ainda existe: há rota marcada com auth
    expect(auth).toContain("requireAuth");
    expect(auth).not.toContain("authRoutes");
    expect(file(files, "services/api/src/index.ts")).not.toContain('app.route("/auth"');
    expect(usesOwnAuth(g)).toBe(false);
  });
});

describe("store: diagrama ER acompanha a auth", () => {
  it("ligar API → Autenticação Própria cria users com password_hash no canvas Banco", async () => {
    const { useStudio } = await import("@/lib/draft/store");
    const s = useStudio.getState();
    s.setDb({ tables: [], relations: [] });
    s.setArch({
      nodes: [
        { id: "a", kind: "api", name: "API", props: { routes: "GET /health" }, position: { x: 0, y: 0 } },
        { id: "u", kind: "auth", name: "Login", props: { mode: "externa" }, position: { x: 0, y: 0 } },
      ],
      edges: [{ id: "e", source: "a", target: "u", kind: "http" }],
    });
    expect(useStudio.getState().db.tables).toHaveLength(0); // externa: nada muda
    s.setArch((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === "u" ? { ...n, props: { mode: "propria" } } : n)) }));
    const users = useStudio.getState().db.tables.find((t) => t.name === "users");
    expect(users?.columns.map((c) => c.name)).toEqual(expect.arrayContaining(["email", "password_hash"]));
  });
});

describe("revisão", () => {
  it("A15: auth própria sem gravar no Postgres", () => {
    const { graph, er } = sample();
    const g: ArchGraph = { ...graph, edges: graph.edges.filter((e) => graph.nodes.find((n) => n.id === e.target)?.kind !== "postgres") };
    expect(reviewArch(g, er).some((f) => f.code === "A15")).toBe(true);
    expect(reviewArch(graph, er).some((f) => f.code === "A15")).toBe(false);
  });
});
