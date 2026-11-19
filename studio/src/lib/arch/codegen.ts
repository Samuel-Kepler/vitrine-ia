// Grafo de arquitetura -> moldes de backend (Node 24 + Hono + Docker).
// Determinístico. Quando uma rota bate com uma tabela do canvas Banco e o
// serviço grava no Postgres, o handler já sai com SQL de verdade.
import { ARCH, authMode, routeLines, type ArchGraph, type ArchNode, type RouteLine } from "./model";
import { ensureAuthUsers, fkColumns, pascal, PASSWORD_COL, pkOf, snake, USERS_TABLE, type ColType, type ErModel, type Table } from "@/lib/db/model";
import { toSql, type GeneratedFile } from "@/lib/db/codegen";
import { authFile, type OwnAuthSpec } from "./codegen-auth";

export const TEMPLATE_VERSIONS = {
  hono: "4.13.19",
  "@hono/node-server": "2.1.9",
  pg: "8.23.1",
  "@types/pg": "8.23.1",
  ioredis: "6.0.0",
  zod: "4.6.7",
  tsx: "4.23.15",
  typescript: "5.9.3",
  "@types/node": "24.19.2",
} as const;

export function slugName(s: string): string {
  return snake(s).replace(/_/g, "-") || "servico";
}
const envName = (n: ArchNode) => snake(n.name).toUpperCase();
/** Nome do banco configurado no canvas, seguro para URL, POSTGRES_DB e pg_isready. */
export const dbName = (n: ArchNode) => (n.props.database?.trim() ? snake(n.props.database) : "app");

interface ServicePlan {
  node: ArchNode;
  slug: string;
  port: number;
  httpTargets: ArchNode[];
  db?: ArchNode;
  dbWrites: boolean;
  cache?: ArchNode;
  publishes: ArchNode[];
  consumes: ArchNode[];
  storage?: ArchNode;
  /** Bloco de Autenticação "Própria" ligado a este serviço (exige Postgres com escrita). */
  ownAuth?: ArchNode;
  /** Precisa de src/auth.ts (auth própria ou alguma rota marcada com "auth"). */
  jwt: boolean;
}

function plan(graph: ArchGraph): ServicePlan[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const slugs = new Set<string>();
  let nextPort = 3001;
  return graph.nodes
    .filter((n) => ARCH[n.kind].runnable)
    .map((node) => {
      let slug = slugName(node.name);
      for (let i = 2; slugs.has(slug); i++) slug = `${slugName(node.name)}-${i}`;
      slugs.add(slug);
      const out = graph.edges.filter((e) => e.source === node.id).map((e) => ({ e, t: byId.get(e.target)! })).filter((x) => x.t);
      const inc = graph.edges.filter((e) => e.target === node.id).map((e) => ({ e, s: byId.get(e.source)! })).filter((x) => x.s);
      const dbEdges = out.filter((x) => x.t.kind === "postgres");
      const explicit = Number(node.props.port);
      const dbWrites = dbEdges.some((x) => x.e.kind === "writes");
      const http = node.kind !== "worker";
      // Auth própria vira código dentro do serviço; só faz sentido com Postgres gravável.
      const ownAuth = http && dbWrites ? out.find((x) => x.t.kind === "auth" && authMode(x.t) === "propria")?.t : undefined;
      const anyProtected = http && routeLines(node.props.routes).some((r) => r.protected);
      return {
        node,
        slug,
        port: Number.isInteger(explicit) && explicit > 0 ? explicit : nextPort++,
        httpTargets: out.filter((x) => x.e.kind === "http" && ["api", "service", "external", "auth"].includes(x.t.kind) && x.t !== ownAuth).map((x) => x.t),
        db: dbEdges[0]?.t,
        dbWrites,
        ownAuth,
        jwt: !!ownAuth || anyProtected,
        cache: out.find((x) => x.t.kind === "cache")?.t,
        publishes: out.filter((x) => x.t.kind === "queue").map((x) => x.t),
        consumes: inc.filter((x) => x.s.kind === "queue").map((x) => x.s),
        storage: out.find((x) => x.t.kind === "storage")?.t,
      };
    });
}

const streamName = (q: ArchNode) => q.props.stream?.trim() || snake(q.name);

function tableForPath(path: string, er: ErModel): Table | undefined {
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return undefined;
  return er.tables.find((t) => snake(t.name) === snake(seg));
}

const GENERATED_DEFAULTS = new Set(["now", "uuid", "autoincrement"]);

interface BodyField {
  name: string;
  zod: string;
}

/** Campos que o cliente pode mandar no POST: colunas sem default gerado + FKs. */
function bodyFields(t: Table, er: ErModel): BodyField[] {
  const out: BodyField[] = [];
  for (const c of t.columns) {
    if (c.default && GENERATED_DEFAULTS.has(c.default)) continue;
    if (snake(c.name) === PASSWORD_COL) continue; // só /auth/register grava o hash
    if (c.pk && c.default) continue;
    let z = zodFor(c.type, c.name, !c.nullable && !c.default);
    if (c.nullable) z += ".nullish()";
    else if (c.default) z += ".optional()";
    out.push({ name: snake(c.name), zod: z });
  }
  for (const f of fkColumns(er).filter((f) => f.table.id === t.id)) {
    out.push({ name: f.name, zod: zodFor(f.type, f.name, !f.nullable) + (f.nullable ? ".nullish()" : "") });
  }
  return out;
}

function zodFor(type: ColType, name: string, required: boolean): string {
  switch (type) {
    case "uuid":
      return "z.uuid()";
    case "varchar":
      return /e_?mail/i.test(name) ? "z.email().max(255)" : `z.string().trim()${required ? ".min(1)" : ""}.max(255)`;
    case "text":
      return `z.string().trim()${required ? ".min(1)" : ""}`;
    case "int":
      return "z.int32()";
    case "bigint":
      return "z.int()";
    case "decimal":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "timestamp":
      return "z.iso.datetime({ offset: true })";
    case "date":
      return "z.iso.date()";
    case "json":
      return "z.json()";
  }
}

const schemaName = (t: Table) => `${pascal(t.name)}Input`;

/**
 * Colunas devolvidas ao cliente, sempre explícitas (nunca "*"): coluna nova no
 * banco não vaza sozinha na API, e o hash de senha nunca sai.
 */
function selectList(t: Table, er: ErModel): string {
  const cols = [...t.columns.map((c) => snake(c.name)).filter((n) => n !== PASSWORD_COL), ...fkColumns(er).filter((f) => f.table.id === t.id).map((f) => f.name)];
  return cols.map((c) => `"${c}"`).join(", ");
}

/** FK desta tabela para users: numa rota protegida vem do token, não do corpo. */
function userFk(t: Table, er: ErModel): string | undefined {
  return fkColumns(er).find((f) => f.table.id === t.id && snake(f.ref.name) === USERS_TABLE)?.name;
}

function ownAuthSpec(er: ErModel): OwnAuthSpec {
  const users = er.tables.find((t) => snake(t.name) === USERS_TABLE)!;
  return {
    userCols: selectList(users, er),
    pk: snake(pkOf(users)?.name ?? "id"),
    extraFields: bodyFields(users, er).filter((f) => f.name !== "email"),
  };
}

/** Tabelas que recebem POST com SQL gerado neste serviço. */
function postTables(p: ServicePlan, er: ErModel): Table[] {
  if (!p.db || !p.dbWrites) return [];
  const out = new Map<string, Table>();
  for (const r of routeLines(p.node.props.routes)) {
    const t = r.method === "POST" && !/\/:\w+|\{\w+\}/.test(r.path) ? tableForPath(r.path, er) : undefined;
    if (t && bodyFields(t, er).length) out.set(t.id, t);
  }
  return [...out.values()];
}

function schemasFile(tables: Table[], er: ErModel): string {
  const parts = [
    "// Validação dos corpos de requisição, derivada das colunas do canvas Banco.",
    "// NOT NULL sem default = obrigatório; colunas com default ou nulas = opcionais.",
    'import { z } from "zod";',
    "",
    "z.config(z.locales.pt());",
  ];
  for (const t of tables) {
    parts.push("", `export const ${schemaName(t)} = z.object({`, ...bodyFields(t, er).map((f) => `  ${JSON.stringify(f.name)}: ${f.zod},`), "});");
  }
  return parts.join("\n") + "\n";
}

function routeHandler(p: ServicePlan, route: RouteLine, er: ErModel): string {
  const { method, path } = route;
  const honoPath = path.replace(/\{(\w+)\}/g, ":$1");
  const table = p.db ? tableForPath(path, er) : undefined;
  const hasId = /\/:\w+|\{\w+\}/.test(path);
  const tn = table ? snake(table.name) : "";
  const publish = p.publishes[0];
  const notify = publish ? `\n  await publish("${streamName(publish)}", { type: "${tn || "evento"}.${method === "POST" ? "created" : "changed"}", data: row });` : "";
  const guard = route.protected ? "requireAuth, " : "";
  const cols = table ? selectList(table, er) : "*";

  if (table && method === "GET" && !hasId) {
    return `app.get("${honoPath}", ${guard}async (c) => {
  const { rows } = await db.query('select ${cols} from "${tn}" limit 100');
  return c.json(rows);
});`;
  }
  if (table && method === "GET" && hasId) {
    return `app.get("${honoPath}", ${guard}async (c) => {
  const { rows } = await db.query('select ${cols} from "${tn}" where "${snake(table.columns.find((col) => col.pk)?.name ?? "id")}" = $1', [c.req.param("${honoPath.match(/:(\w+)/)?.[1] ?? "id"}")]);
  return rows[0] ? c.json(rows[0]) : c.json({ error: "não encontrado" }, 404);
});`;
  }
  if (table && method === "POST" && p.dbWrites && !hasId && bodyFields(table, er).length) {
    // Rota protegida com FK para users: o dono vem do token (sub), não do corpo.
    const owner = route.protected ? userFk(table, er) : undefined;
    const schema = owner ? `${schemaName(table)}.omit({ ${JSON.stringify(owner)}: true })` : schemaName(table);
    const data = owner
      ? `const data: [string, unknown][] = [...Object.entries(parsed.data).filter(([, v]) => v !== undefined), ["${owner}", c.get("jwtPayload").sub]];`
      : "const data = Object.entries(parsed.data).filter(([, v]) => v !== undefined);";
    return `app.post("${honoPath}", ${guard}async (c) => {
  const parsed = ${schema}.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Corpo inválido.", issues: issuesOf(parsed.error) }, 400);
  // Só entram colunas conhecidas pelo schema (o zod descarta o resto), então os nomes são seguros.
  ${data}
  const sql = data.length
    ? \`insert into "${tn}" (\${data.map(([k]) => \`"\${k}"\`).join(", ")}) values (\${data.map((_, i) => \`$\${i + 1}\`).join(", ")}) returning ${cols}\`
    : 'insert into "${tn}" default values returning ${cols}';
  const { rows } = await db.query(sql, data.map(([, v]) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v)));
  const row = rows[0];${notify}
  return c.json(row, 201);
});`;
  }
  const verb = method.toLowerCase();
  return `app.${verb}("${honoPath}", ${guard}async (c) => {
  // TODO: implemente ${method} ${path}
  return c.json({ todo: "${method} ${path}" }, 501);
});`;
}

function serviceIndex(p: ServicePlan, er: ErModel): string {
  const imports: string[] = [];
  const isHttp = p.node.kind !== "worker";
  if (isHttp)
    imports.push(
      'import { Hono } from "hono";',
      'import { HTTPException } from "hono/http-exception";',
      'import { bodyLimit } from "hono/body-limit";',
      'import { cors } from "hono/cors";',
      'import { secureHeaders } from "hono/secure-headers";',
      'import { serve } from "@hono/node-server";',
    );
  if (p.db) imports.push('import { db } from "./db.js";');
  const posts = isHttp ? postTables(p, er) : [];
  if (posts.length) imports.push('import type { z } from "zod";', `import { ${posts.map(schemaName).join(", ")} } from "./schemas.js";`);
  if (isHttp && p.jwt) imports.push(`import { ${p.ownAuth ? "authRoutes, " : ""}requireAuth, type AuthEnv } from "./auth.js";`);
  if (p.cache) imports.push('import { cache } from "./cache.js";');
  const queueFns = [...(p.publishes.length ? ["publish"] : []), ...(p.consumes.length ? ["consume"] : []), ...(p.publishes.length || p.consumes.length ? [...(isHttp ? ["pingQueue"] : []), "closeQueue"] : [])];
  if (queueFns.length) imports.push(`import { ${queueFns.join(", ")} } from "./queue.js";`);
  if (p.httpTargets.length) imports.push(`import { ${p.httpTargets.map((t) => clientFn(t)).join(", ")} } from "./clients.js";`);
  const uniqImports = [...new Set(imports)];
  const parts = [`// ${p.node.name} — gerado pelo Vitrine Studio`, ...uniqImports, ""];
  if (!isHttp) parts.push("let shuttingDown = false;");

  if (isHttp) {
    const routes = routeLines(p.node.props.routes);
    parts.push(p.jwt ? "const app = new Hono<AuthEnv>();" : "const app = new Hono();", "", HARDENING, "", 'app.get("/health", (c) => c.json({ ok: true, service: "' + p.slug + '" }));', readyRoute(p), "");
    if (posts.length) parts.push(ISSUES_FN, "");
    parts.push(onErrorHandler(!!p.db), "");
    if (p.ownAuth) parts.push("// POST /auth/register, POST /auth/login, GET /auth/me (ver src/auth.ts)", 'app.route("/auth", authRoutes);', "");
    // Com auth própria, /auth/* já vem de src/auth.ts: linhas iguais no canvas não duplicam a rota.
    const own = (r: RouteLine) => !!p.ownAuth && /^\/auth(\/|$)/.test(r.path);
    for (const r of routes.filter((r) => !(r.method === "GET" && r.path === "/health") && !own(r))) parts.push(routeHandler(p, r, er), "");
    if (p.httpTargets.length || p.cache) {
      parts.push(
        `// Exemplo de uso das dependências ligadas no canvas:`,
        ...p.httpTargets.map((t) => `//   await ${clientFn(t)}("/caminho")  -> ${t.name}`),
        ...(p.cache ? [`//   await cache.get("chave") / cache.set("chave", valor, "EX", 60)`] : []),
        "",
      );
    }
    parts.push(
      "// Os testes (test/app.test.ts) importam o app sem abrir a porta.",
      "export default app;",
      "",
      'if (process.env.NODE_ENV !== "test") {',
      `  const port = Number(process.env.PORT ?? ${p.port});`,
      `  const server = serve({ fetch: app.fetch, port }, () => console.log(\`${p.slug} ouvindo em http://localhost:\${port}\`));`,
    );
  }
  const ind = isHttp ? "  " : "";
  for (const q of p.consumes) {
    parts.push(
      "",
      `${ind}// Cada fila roda em paralelo; se o consumo não conseguir nem começar, o processo cai e o Docker reinicia.`,
      `${ind}consume("${streamName(q)}", "${p.slug}", async (event) => {`,
      `${ind}  console.log("[${p.slug}] evento recebido", event);`,
      `${ind}  // TODO: processe o evento (ex.: enviar e-mail, atualizar CRM).`,
      `${ind}  // Lançar erro aqui = o evento volta para nova tentativa (e vai para a dead-letter depois de várias).`,
      `${ind}}).catch((err) => {`,
      `${ind}  console.error("[${p.slug}] consumo parou:", err);`,
      `${ind}  process.exit(1);`,
      `${ind}});`,
    );
  }
  if (!isHttp && !p.consumes.length) {
    parts.push("// Worker sem fila ligada: ligue uma Fila -> este worker no canvas.", 'const timer = setInterval(() => console.log("worker vivo"), 60_000);');
  }
  parts.push("", ...shutdownBlock(p).split("\n").map((l) => (l ? ind + l : l)));
  if (isHttp) parts.push("}");
  return parts.join("\n") + "\n";
}

// Desligamento gracioso: "docker stop" manda SIGTERM e espera 10 s antes do
// SIGKILL. Paramos de aceitar trabalho novo, terminamos o que está em andamento
// e fechamos as conexões, com um limite de 9 s.
function shutdownBlock(p: ServicePlan): string {
  const isHttp = p.node.kind !== "worker";
  const steps = [
    ...(isHttp ? ["await new Promise<void>((resolve) => server.close(() => resolve())); // termina as requisições em andamento"] : []),
    ...(!isHttp && !p.consumes.length ? ["clearInterval(timer);"] : []),
    ...(p.publishes.length || p.consumes.length ? ["await closeQueue(); // o consumo termina o evento atual antes de parar"] : []),
    ...(p.cache ? ["await cache.quit();"] : []),
    ...(p.db ? ["await db.end();"] : []),
  ];
  return `// Desligamento gracioso (docker stop manda SIGTERM e mata em 10 s).
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;${isHttp ? " // /ready passa a responder 503" : ""}
  console.log(\`[${p.slug}] \${signal}: desligando...\`);
  setTimeout(() => process.exit(1), 9_000).unref(); // não trava o docker stop
  try {
${steps.map((s) => `    ${s}`).join("\n")}
  } catch (err) {
    console.error("[${p.slug}] erro ao desligar:", err);
    process.exit(1);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));`;
}

// Prontidão: /health diz que o processo está vivo; /ready diz se as
// dependências (Postgres, Redis, fila) respondem. 503 quando alguma falha ou
// quando o serviço está desligando.
function readyRoute(p: ServicePlan): string {
  const checks = [
    ...(p.db ? ['postgres: () => db.query("select 1")'] : []),
    ...(p.cache ? ["redis: () => cache.ping()"] : []),
    ...(p.publishes.length || p.consumes.length ? ["fila: () => pingQueue()"] : []),
  ];
  return `let shuttingDown = false;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(\`sem resposta em \${ms} ms\`)), ms).unref())]);
}

// /health = processo vivo (healthcheck do Docker); /ready = dependências respondendo.
const READY_CHECKS: Record<string, () => Promise<unknown>> = {${checks.map((c) => `\n  ${c},`).join("")}
};
app.get("/ready", async (c) => {
  if (shuttingDown) return c.json({ ok: false, status: "desligando" }, 503);
  const entries = await Promise.all(
    Object.entries(READY_CHECKS).map(async ([name, check]) => {
      try {
        await withTimeout(check(), 2_000);
        return [name, "ok"] as const;
      } catch (err) {
        console.error(\`[ready] \${name}:\`, (err as Error).message);
        return [name, "falhou"] as const; // detalhe só no log, não na resposta
      }
    }),
  );
  const ok = entries.every(([, s]) => s === "ok");
  return c.json({ ok, ...Object.fromEntries(entries) }, ok ? 200 : 503);
});`;
}

/** Porta do site (nginx) no projeto completo; é a origem liberada no CORS por padrão. */
export const WEB_PORT = 8080;
export const BODY_LIMIT_KB = 100;

// Segurança básica de toda API gerada (middlewares do próprio Hono, sem dependência nova).
const HARDENING = `// Segurança básica: cabeçalhos seguros, corpo de no máximo ${BODY_LIMIT_KB} KB e CORS só
// para as origens de CORS_ORIGINS (separadas por vírgula; vazio = nenhum site de fora).
app.use(secureHeaders());
app.use(bodyLimit({ maxSize: ${BODY_LIMIT_KB} * 1024, onError: (c) => c.json({ error: "Corpo grande demais (máx. ${BODY_LIMIT_KB} KB)." }, 413) }));
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean) }));`;

const ISSUES_FN = `function issuesOf(error: z.ZodError) {
  return error.issues.map((i) => ({ campo: i.path.join(".") || "(corpo)", erro: i.message }));
}`;

// Erros do Postgres que são culpa do cliente viram 4xx em vez de 500.
function onErrorHandler(hasDb: boolean): string {
  const pg = hasDb
    ? `
  const pg = err as { code?: string; detail?: string; constraint?: string };
  if (pg.code === "23505") return c.json({ error: "Já existe um registro com esse valor.", detail: pg.detail }, 409);
  if (pg.code === "23503") return c.json({ error: "Referência inexistente.", detail: pg.detail }, 409);
  if (pg.code && ["22P02", "22001", "22003", "22007", "22008", "23502", "23514"].includes(pg.code)) {
    return c.json({ error: "Valor inválido para o banco.", detail: pg.detail ?? err.message }, 400);
  }`
    : "";
  return `app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();${pg}
  console.error(err);
  return c.json({ error: "Erro interno." }, 500);
});`;
}

// Multi-stage: instala e compila com tsc, depois copia só dist + deps de produção
// para uma imagem alpine rodando como o usuário "node" (não-root).
function dockerfile(p: ServicePlan): string {
  const http = p.node.kind !== "worker";
  return `FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# npm ci quando houver lockfile (build reprodutível); senão npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
${http ? `ENV PORT=${p.port}
EXPOSE ${p.port}
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:$PORT/health || exit 1
` : ""}CMD ["node", "dist/index.js"]
`;
}

const clientFn = (t: ArchNode) => `call${snake(t.name).split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}`;

// Testes de fumaça de cada API (node:test + app.request do Hono). Rodam sem
// Postgres nem Redis: cobrem só o que acontece antes do banco (validação,
// autenticação, cabeçalhos), então não quebram quando a regra de negócio mudar.
function testsFile(p: ServicePlan, er: ErModel): string {
  const own = (r: RouteLine) => !!p.ownAuth && /^\/auth(\/|$)/.test(r.path);
  const routes = routeLines(p.node.props.routes).filter((r) => !(r.method === "GET" && r.path === "/health") && !own(r));
  const url = (path: string) => path.replace(/:\w+|\{\w+\}/g, "1");
  const jwt = !!p.jwt;
  const cases: string[] = [];

  for (const r of routes.filter((r) => r.protected)) {
    cases.push(`  it("${r.method} ${r.path} sem token: 401", async () => {
    const res = await app.request("${url(r.path)}", { method: "${r.method}" });
    assert.equal(res.status, 401);
  });`);
  }
  const hasId = (path: string) => /\/:\w+|\{\w+\}/.test(path);
  for (const r of routes.filter((r) => r.method === "POST" && !hasId(r.path))) {
    const t = p.db && p.dbWrites ? tableForPath(r.path, er) : undefined;
    if (!t || !bodyFields(t, er).length) continue;
    cases.push(`  it("POST ${r.path} rejeita corpo inválido com 400", async () => {
    const res = await app.request("${r.path}", { method: "POST", body: "[]", headers: { "content-type": "application/json"${r.protected ? ", authorization: `Bearer ${await token()}`" : ""} } });
    assert.equal(res.status, 400);
    assert.ok(Array.isArray((await res.json()).issues));
  });`);
  }
  if (p.ownAuth) {
    cases.push(`  it("POST /auth/register e /auth/login validam o corpo", async () => {
    for (const path of ["/auth/register", "/auth/login"]) {
      const res = await app.request(path, { method: "POST", body: JSON.stringify({ email: "não-é-email", password: "x" }), headers: { "content-type": "application/json" } });
      assert.equal(res.status, 400, path);
    }
  });`, `  it("GET /auth/me sem token: 401; token com outro segredo: 401", async () => {
    assert.equal((await app.request("/auth/me")).status, 401);
    const forged = await sign({ sub: "1", email: "a@b.c", exp: Math.floor(Date.now() / 1000) + 60 }, "outro-segredo-".repeat(4), "HS256");
    assert.equal((await app.request("/auth/me", { headers: { authorization: \`Bearer \${forged}\` } })).status, 401);
  });`);
  }

  return `// Testes de fumaça de ${p.node.name} — gerado pelo Vitrine Studio.
// Rodam sem Postgres nem Redis (só o que acontece antes do banco): npm test
// Para testar SQL de verdade, suba o compose e use DATABASE_URL apontando para ele.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
${jwt ? 'import { sign } from "hono/jwt";\n' : ""}
process.env.NODE_ENV = "test"; // o app não abre a porta
process.env.CORS_ORIGINS = "http://localhost:${WEB_PORT}";
${jwt ? 'process.env.JWT_SECRET = "segredo-de-teste-".repeat(4);\n' : ""}const { default: app } = await import("../src/index.js");
${jwt ? `
/** Token válido para as rotas com auth (o "sub" é o id do usuário). */
function token(sub = "00000000-0000-0000-0000-000000000001") {
  return sign({ sub, email: "teste@exemplo.com", exp: Math.floor(Date.now() / 1000) + 60 }, process.env.JWT_SECRET!, "HS256");
}
` : ""}
describe("${p.node.name}: base", () => {
  it("GET /health responde 200", async () => {
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
  });

  it("cabeçalhos seguros", async () => {
    const res = await app.request("/health");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.ok(res.headers.get("x-frame-options"));
  });

  it("CORS libera só as origens de CORS_ORIGINS", async () => {
    const ok = await app.request("/health", { headers: { origin: "http://localhost:${WEB_PORT}" } });
    assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:${WEB_PORT}");
    const evil = await app.request("/health", { headers: { origin: "https://evil.example" } });
    assert.equal(evil.headers.get("access-control-allow-origin"), null);
  });

  it("corpo acima de ${BODY_LIMIT_KB} KB: 413", async () => {
    const body = "x".repeat(${BODY_LIMIT_KB + 1} * 1024);
    const res = await app.request("/health", { method: "POST", body, headers: { "content-type": "application/json", "content-length": String(body.length) } });
    assert.equal(res.status, 413);
  });
});
${cases.length ? `\ndescribe("${p.node.name}: rotas", () => {\n${cases.join("\n\n")}\n});\n` : ""}`;
}

function serviceFiles(p: ServicePlan, er: ErModel): GeneratedFile[] {
  const base = `services/${p.slug}`;
  const isHttp = p.node.kind !== "worker";
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = { tsx: TEMPLATE_VERSIONS.tsx, typescript: TEMPLATE_VERSIONS.typescript, "@types/node": TEMPLATE_VERSIONS["@types/node"] };
  if (p.node.kind !== "worker") Object.assign(deps, { hono: TEMPLATE_VERSIONS.hono, "@hono/node-server": TEMPLATE_VERSIONS["@hono/node-server"] });
  if (p.db) {
    deps.pg = TEMPLATE_VERSIONS.pg;
    devDeps["@types/pg"] = TEMPLATE_VERSIONS["@types/pg"];
  }
  if (p.cache || p.publishes.length || p.consumes.length) deps.ioredis = TEMPLATE_VERSIONS.ioredis;
  const posts = p.node.kind !== "worker" ? postTables(p, er) : [];
  if (posts.length || p.ownAuth) deps.zod = TEMPLATE_VERSIONS.zod;

  const files: GeneratedFile[] = [
    {
      path: `${base}/package.json`,
      content:
        JSON.stringify(
          {
            name: p.slug,
            private: true,
            type: "module",
            scripts: { dev: "tsx watch src/index.ts", build: "tsc", start: "node dist/index.js", typecheck: "tsc --noEmit", ...(isHttp ? { test: "tsx --test test/*.test.ts" } : {}) },
            dependencies: deps,
            devDependencies: devDeps,
          },
          null,
          2,
        ) + "\n",
    },
    {
      path: `${base}/tsconfig.json`,
      content:
        JSON.stringify(
          { compilerOptions: { target: "ES2023", module: "NodeNext", moduleResolution: "NodeNext", strict: true, outDir: "dist", rootDir: "src", skipLibCheck: true }, include: ["src"] },
          null,
          2,
        ) + "\n",
    },
    { path: `${base}/Dockerfile`, content: dockerfile(p) },
    { path: `${base}/.dockerignore`, content: "node_modules\ndist\nnpm-debug.log\n.env\n" },
    { path: `${base}/src/index.ts`, content: serviceIndex(p, er) },
  ];
  if (isHttp) files.push({ path: `${base}/test/app.test.ts`, content: testsFile(p, er) });
  if (posts.length) files.push({ path: `${base}/src/schemas.ts`, content: schemasFile(posts, er) });
  if (p.jwt && p.node.kind !== "worker") files.push({ path: `${base}/src/auth.ts`, content: authFile(p.ownAuth ? ownAuthSpec(er) : undefined) });
  if (p.db) {
    files.push({
      path: `${base}/src/db.ts`,
      content: `import pg from "pg";

// Pool com limites: sem eles, o banco fora do ar ou uma consulta travada
// prendem a requisição para sempre.
export const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  connectionTimeoutMillis: 5_000, // espera por uma conexão livre
  idleTimeoutMillis: 30_000,
  statement_timeout: 10_000, // consulta mais longa que isso é cancelada pelo Postgres
});

// Erro numa conexão ociosa (ex.: o Postgres reiniciou) não pode derrubar o processo.
db.on("error", (err) => console.error("[db] conexão perdida:", err.message));
`,
    });
  }
  if (p.cache) {
    files.push({
      path: `${base}/src/cache.ts`,
      content: `import { Redis } from "ioredis";

// lazyConnect: conecta no primeiro comando (importar o módulo nos testes não abre conexão).
export const cache = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { lazyConnect: true });
`,
    });
  }
  if (p.publishes.length || p.consumes.length) {
    files.push({
      path: `${base}/src/queue.ts`,
      content: `// Fila com Redis Streams: entrega "pelo menos uma vez", com nova tentativa e dead-letter.
// - Evento cujo handler lança erro não é confirmado (XACK): volta depois de QUEUE_RETRY_IDLE_MS.
// - Depois de QUEUE_MAX_DELIVERIES tentativas (ou JSON inválido) vai para "<stream>:dlq",
//   com o erro, para inspeção:  docker compose exec redis redis-cli XRANGE eventos:dlq - +
// Como um evento pode chegar mais de uma vez, o handler deve ser idempotente.
import { hostname } from "node:os";
import { Redis } from "ioredis";

// lazyConnect: conecta no primeiro comando (importar o módulo nos testes não abre conexão).
const redis = new Redis(process.env.QUEUE_URL ?? "redis://localhost:6379", { lazyConnect: true });

const MAX_DELIVERIES = Number(process.env.QUEUE_MAX_DELIVERIES ?? 5);
const RETRY_IDLE_MS = Number(process.env.QUEUE_RETRY_IDLE_MS ?? 30_000);
const BLOCK_MS = 5_000;

type Entry = [id: string, fields: string[]];
type Handler = (event: unknown) => Promise<void>;

let stopping = false;
const loops = new Set<Promise<void>>();

export async function publish(stream: string, event: unknown): Promise<void> {
  await redis.xadd(stream, "*", "data", JSON.stringify(event));
}

export function pingQueue(): Promise<unknown> {
  return redis.ping();
}

/** Para os consumidores (terminam o evento atual; até 5 s ms) e fecha a conexão. */
export async function closeQueue(): Promise<void> {
  stopping = true;
  await Promise.allSettled(loops);
  await redis.quit().catch(() => {});
}

async function deadLetter(stream: string, group: string, [id, fields]: Entry, reason: string, deliveries: number) {
  await redis.xadd(\`\${stream}:dlq\`, "*", "data", fields[1] ?? "null", "error", reason, "source_id", id, "group", group, "deliveries", String(deliveries));
  await redis.xack(stream, group, id);
  console.error(\`[fila] \${stream} \${id} -> \${stream}:dlq (\${deliveries} tentativa(s)): \${reason}\`);
}

async function deliver(stream: string, group: string, handle: Handler, entry: Entry, deliveries: number) {
  let event: unknown;
  try {
    event = JSON.parse(entry[1][1] ?? "null");
  } catch {
    return deadLetter(stream, group, entry, "JSON inválido", deliveries); // nunca vai dar certo: sem retry
  }
  try {
    await handle(event);
    await redis.xack(stream, group, entry[0]);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (deliveries >= MAX_DELIVERIES) return deadLetter(stream, group, entry, reason, deliveries);
    console.warn(\`[fila] \${stream} \${entry[0]} falhou (tentativa \${deliveries}/\${MAX_DELIVERIES}): \${reason}\`);
  }
}

/** Pega de volta eventos parados há RETRY_IDLE_MS (falharam ou o consumidor caiu) e tenta de novo. */
async function retryStale(stream: string, group: string, consumer: string, handle: Handler) {
  const pending = (await redis.call("XPENDING", stream, group, "IDLE", RETRY_IDLE_MS, "-", "+", 10)) as [string, string, number, number][];
  for (const [id, , , count] of pending) {
    const claimed = (await redis.call("XCLAIM", stream, group, consumer, RETRY_IDLE_MS, id)) as (Entry | null)[];
    for (const entry of claimed) if (entry?.[1]) await deliver(stream, group, handle, entry, count + 1);
  }
}

async function loop(stream: string, group: string, handle: Handler) {
  // hostname = id do contêiner: réplicas diferentes não se confundem (o pid é sempre 1 no Docker).
  const consumer = \`\${group}-\${hostname()}\`;
  await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM").catch((err: Error) => {
    if (!err.message.includes("BUSYGROUP")) throw err; // BUSYGROUP = o grupo já existe
  });
  let lastRetry = 0;
  while (!stopping) {
    try {
      if (Date.now() - lastRetry >= RETRY_IDLE_MS / 2) {
        lastRetry = Date.now();
        await retryStale(stream, group, consumer, handle);
      }
      const res = (await redis.xreadgroup("GROUP", group, consumer, "COUNT", 10, "BLOCK", BLOCK_MS, "STREAMS", stream, ">")) as [string, Entry[]][] | null;
      for (const [, entries] of res ?? []) for (const entry of entries) await deliver(stream, group, handle, entry, 1);
    } catch (err) {
      if (stopping) break;
      // Redis caiu ou reiniciou: o ioredis reconecta; esperamos um pouco e seguimos.
      console.error(\`[fila] \${stream}: \${(err as Error).message}; tentando de novo em 1 s\`);
      await new Promise((r) => setTimeout(r, 1_000));
    }
  }
}

/** Consome o stream até closeQueue(). Rejeita só se não conseguir nem criar o grupo. */
export function consume(stream: string, group: string, handle: Handler): Promise<void> {
  const run = loop(stream, group, handle);
  loops.add(run);
  return run;
}
`,
    });
  }
  if (p.httpTargets.length) {
    files.push({
      path: `${base}/src/clients.ts`,
      content:
        `// Clientes HTTP para as dependências ligadas no canvas.\n` +
        p.httpTargets
          .map(
            (t) => `export async function ${clientFn(t)}(path: string, init?: RequestInit): Promise<Response> {
  const base = process.env.${envName(t)}_URL ?? "${t.kind === "external" || t.kind === "auth" ? t.props.url || t.props.issuer || "" : `http://localhost`}";
  return fetch(new URL(path, base), init);
}`,
          )
          .join("\n\n") +
        "\n",
    });
  }
  if (p.node.kind === "api") files.push({ path: `${base}/openapi.yaml`, content: openapi(p) });
  return files;
}

function openapi(p: ServicePlan): string {
  const routes: RouteLine[] = routeLines(p.node.props.routes).filter((r) => !(p.ownAuth && /^\/auth(\/|$)/.test(r.path)));
  if (p.ownAuth) {
    routes.push({ method: "POST", path: "/auth/register", protected: false }, { method: "POST", path: "/auth/login", protected: false }, { method: "GET", path: "/auth/me", protected: true });
  }
  const byPath = new Map<string, RouteLine[]>();
  for (const r of routes) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r]);
  if (!byPath.has("/health")) byPath.set("/health", [{ method: "GET", path: "/health", protected: false }]);
  if (!byPath.has("/ready")) byPath.set("/ready", [{ method: "GET", path: "/ready", protected: false }]);
  const lines = ["openapi: 3.1.0", "info:", `  title: ${JSON.stringify(p.node.name)}`, "  version: 0.1.0", "servers:", `  - url: http://localhost:${p.port}`, "paths:"];
  for (const [path, rs] of byPath) {
    lines.push(`  ${path.replace(/:(\w+)/g, "{$1}")}:`);
    for (const r of rs) {
      const ok = r.method === "POST" && path !== "/auth/login" ? "201" : "200";
      lines.push(`    ${r.method.toLowerCase()}:`, `      summary: ${r.method} ${path}`);
      if (r.protected) lines.push("      security:", "        - bearerAuth: []");
      lines.push("      responses:", `        "${ok}":`, "          description: OK");
      if (r.protected) lines.push('        "401":', "          description: Token ausente ou inválido");
    }
  }
  if (routes.some((r) => r.protected)) lines.push("components:", "  securitySchemes:", "    bearerAuth:", "      type: http", "      scheme: bearer", "      bearerFormat: JWT");
  return lines.join("\n") + "\n";
}

/**
 * Segredos do backend gerado. Cada export recebe valores aleatórios num `.env`
 * (lido pelo docker compose), em vez de senhas fixas iguais para todo mundo.
 * Hex: seguro dentro de URL (DATABASE_URL) e em YAML sem aspas.
 */
export interface BackendSecrets {
  postgresPassword: string;
  jwtSecret: string;
  minioPassword: string;
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSecrets(): BackendSecrets {
  return { postgresPassword: randomHex(16), jwtSecret: randomHex(32), minioPassword: randomHex(16) };
}

/** Valores do .env.example: deixam claro que precisam ser trocados. */
const PLACEHOLDER_SECRETS: BackendSecrets = {
  postgresPassword: "troque-esta-senha",
  jwtSecret: "troque-este-segredo",
  minioPassword: "troque-esta-senha",
};

/** Infra (banco, Redis, MinIO) só escuta no localhost da máquina, não na rede. */
const localPort = (port: number | string, inner = port) => `      - "127.0.0.1:${port}:${inner}"`;
const required = (name: string) => `\${${name}:?defina ${name} no .env}`;

function compose(graph: ArchGraph, plans: ServicePlan[], hasSchema: boolean): string {
  const lines = ["# Gerado pelo Vitrine Studio", "services:"];
  const pg = graph.nodes.find((n) => n.kind === "postgres");
  const needsRedis = graph.nodes.some((n) => n.kind === "cache" || n.kind === "queue");
  const storage = graph.nodes.find((n) => n.kind === "storage");
  for (const p of plans) {
    lines.push(`  ${p.slug}:`, `    build: ./services/${p.slug}`);
    if (p.node.kind !== "worker") lines.push("    ports:", `      - "${p.port}:${p.port}"`);
    const env = p.node.kind === "worker" ? [] : [`PORT: "${p.port}"`, `CORS_ORIGINS: \${CORS_ORIGINS:-http://localhost:${WEB_PORT}}`];
    if (p.db) env.push(`DATABASE_URL: postgres://app:${required("POSTGRES_PASSWORD")}@postgres:5432/${dbName(p.db)}`);
    if (p.cache) env.push("REDIS_URL: redis://redis:6379");
    if (p.publishes.length || p.consumes.length) env.push("QUEUE_URL: redis://redis:6379");
    if (p.jwt) env.push(`JWT_SECRET: ${required("JWT_SECRET")}`);
    for (const t of p.httpTargets) {
      const target = plans.find((x) => x.node.id === t.id);
      env.push(`${envName(t)}_URL: ${target ? `http://${target.slug}:${target.port}` : `\${${envName(t)}_URL:-${t.props.url || t.props.issuer || ""}}`}`);
    }
    if (p.storage) env.push("S3_ENDPOINT: http://minio:9000", `S3_BUCKET: ${p.storage.props.bucket || "uploads"}`);
    lines.push("    environment:", ...env.map((e) => `      ${e}`));
    // Banco e Redis precisam estar prontos (healthcheck), não só "iniciados".
    const deps = new Map<string, string>();
    if (p.db) deps.set("postgres", "service_healthy");
    if (needsRedis && (p.cache || p.publishes.length || p.consumes.length)) deps.set("redis", "service_healthy");
    if (p.storage) deps.set("minio", "service_started");
    for (const t of p.httpTargets) {
      const tp = plans.find((x) => x.node.id === t.id);
      if (tp) deps.set(tp.slug, tp.node.kind === "worker" ? "service_started" : "service_healthy");
    }
    if (deps.size) lines.push("    depends_on:", ...[...deps].flatMap(([d, cond]) => [`      ${d}:`, `        condition: ${cond}`]));
    lines.push("    restart: on-failure");
  }
  if (pg) {
    lines.push(
      "  postgres:",
      "    image: postgres:17-alpine",
      "    environment:",
      "      POSTGRES_USER: app",
      `      POSTGRES_PASSWORD: ${required("POSTGRES_PASSWORD")}`,
      `      POSTGRES_DB: ${dbName(pg)}`,
      "    ports:",
      localPort(5432),
      "    volumes:",
      "      - pgdata:/var/lib/postgresql/data",
      ...(hasSchema ? ["      - ./db/schema.postgres.sql:/docker-entrypoint-initdb.d/001_schema.sql:ro"] : []),
      "    healthcheck:",
      `      test: ["CMD-SHELL", "pg_isready -U app -d ${dbName(pg)}"]`,
      "      interval: 5s",
      "      timeout: 3s",
      "      retries: 10",
    );
  }
  if (needsRedis) {
    lines.push(
      "  redis:",
      "    image: redis:7-alpine",
      "    ports:",
      localPort(6379),
      "    healthcheck:",
      '      test: ["CMD", "redis-cli", "ping"]',
      "      interval: 5s",
      "      timeout: 3s",
      "      retries: 10",
    );
  }
  if (storage) {
    lines.push(
      "  minio:",
      "    image: minio/minio:latest",
      "    command: server /data --console-address :9001",
      "    environment:",
      "      MINIO_ROOT_USER: minio",
      `      MINIO_ROOT_PASSWORD: ${required("MINIO_ROOT_PASSWORD")}`,
      "    ports:",
      localPort(9000),
      localPort(9001),
    );
  }
  if (pg) lines.push("volumes:", "  pgdata:");
  return lines.join("\n") + "\n";
}

const README_DB = `## Banco

\`db/\` traz o schema em SQL (Postgres, MySQL, SQLite), Prisma, Drizzle e DBML.

**O schema só é aplicado quando o volume do Postgres é criado.** O compose monta
\`db/schema.postgres.sql\` em \`/docker-entrypoint-initdb.d/\`, e a imagem do Postgres
só roda esses scripts com o diretório de dados vazio. Se você mudar o schema depois
da primeira subida, ele **não** é reaplicado. Para recriar o banco do zero
(apaga todos os dados):

\`\`\`bash
docker compose down -v   # remove os containers e o volume pgdata
docker compose up --build
\`\`\`

Os serviços só sobem depois que o Postgres e o Redis passam no healthcheck
(\`depends_on: condition: service_healthy\`).

## Erros da API

- Corpo inválido (campo obrigatório faltando, tipo errado, e-mail inválido, JSON quebrado): **400** com \`issues\`.
- Valor duplicado em coluna UNIQUE: **409**.
- Referência para registro inexistente (chave estrangeira): **409**.
`;

function readme(graph: ArchGraph, plans: ServicePlan[], hasSchema: boolean): string {
  const others = graph.nodes.filter((n) => !ARCH[n.kind].runnable);
  return `# Backend gerado pelo Vitrine Studio

Molde inicial: compila, sobe com Docker e tem TODOs onde entra a regra de negócio.

## Subir tudo

\`\`\`bash
docker compose up --build
\`\`\`

O \`.env\` já vem com senhas e segredos **aleatórios, gerados neste export**: não
commite esse arquivo (ele está no \`.gitignore\`). Banco, Redis e MinIO só ficam
acessíveis pelo \`localhost\` desta máquina, não pela rede.

## Serviços

| Serviço | Tipo | Porta | Depende de |
|---|---|---|---|
${plans
  .map(
    (p) =>
      `| ${p.node.name} (\`services/${p.slug}\`) | ${ARCH[p.node.kind].label} | ${p.node.kind === "worker" ? "–" : p.port} | ${[p.db?.name, p.cache?.name, ...p.publishes.map((q) => q.name), ...p.consumes.map((q) => `${q.name} (consome)`), ...p.httpTargets.map((t) => t.name)].filter(Boolean).join(", ") || "–"} |`,
  )
  .join("\n")}

${others.length ? `## Infraestrutura e externos\n\n${others.map((n) => `- **${n.name}** — ${ARCH[n.kind].label}${n.props.url ? ` (${n.props.url})` : ""}`).join("\n")}\n` : ""}
${hasSchema ? README_DB : ""}
${readmeAuth(plans)}
## Rodar um serviço sem Docker

\`\`\`bash
cd services/<nome>
npm install
npm run dev
npm test   # testes de fumaça das APIs (test/), sem precisar de banco
\`\`\`

## Saúde, desligamento e fila

- \`GET /health\`: o processo está vivo (é o healthcheck do Docker).
- \`GET /ready\`: Postgres, Redis e fila respondem (503 se algum falhar ou durante o desligamento).
- \`docker compose stop\` desliga com calma: o serviço para de aceitar requisições,
  termina as que estão em andamento e fecha as conexões (limite de 9 s).
- Fila: evento cujo handler lança erro volta para nova tentativa depois de
  \`QUEUE_RETRY_IDLE_MS\` (30 s); depois de \`QUEUE_MAX_DELIVERIES\` (5) tentativas vai para
  \`<stream>:dlq\`. Como um evento pode chegar mais de uma vez, o handler deve ser idempotente.

Variáveis de ambiente: veja \`.env.example\`.
`;
}

function envFile(graph: ArchGraph, plans: ServicePlan[], s: BackendSecrets, real: boolean): string {
  const lines = real
    ? [
        "# Segredos gerados aleatoriamente neste export. NÃO commite este arquivo (está no .gitignore).",
        "# O docker compose lê este .env; os valores também servem para rodar os serviços fora do Docker.",
      ]
    : ["# Modelo do .env: copie para .env e troque os valores marcados com 'troque'."];
  const pgNode = graph.nodes.find((n) => n.kind === "postgres");
  const hasStorage = graph.nodes.some((n) => n.kind === "storage");
  const jwt = plans.some((p) => p.jwt);
  if (pgNode) lines.push(`POSTGRES_PASSWORD=${s.postgresPassword}`);
  if (jwt) lines.push("# Segredo do JWT (HS256). Para gerar outro: openssl rand -hex 32", `JWT_SECRET=${s.jwtSecret}`);
  if (hasStorage) lines.push(`MINIO_ROOT_PASSWORD=${s.minioPassword}`);
  if (plans.some((p) => p.node.kind !== "worker"))
    lines.push("# Sites que podem chamar a API pelo navegador (separados por vírgula)", `CORS_ORIGINS=http://localhost:${WEB_PORT}`);
  lines.push("", "# Para rodar um serviço fora do Docker (npm run dev)");
  if (pgNode) lines.push(`DATABASE_URL=postgres://app:${s.postgresPassword}@localhost:5432/${dbName(pgNode)}`);
  if (graph.nodes.some((n) => n.kind === "cache")) lines.push("REDIS_URL=redis://localhost:6379");
  if (graph.nodes.some((n) => n.kind === "queue")) lines.push("QUEUE_URL=redis://localhost:6379");
  const targets = new Map<string, string>();
  for (const p of plans) for (const t of p.httpTargets) {
    const tp = plans.find((x) => x.node.id === t.id);
    targets.set(`${envName(t)}_URL`, tp ? `http://localhost:${tp.port}` : t.props.url || t.props.issuer || "");
  }
  for (const [k, v] of targets) lines.push(`${k}=${v}`);
  if (hasStorage) lines.push("S3_ENDPOINT=http://localhost:9000", "S3_BUCKET=uploads");
  return lines.join("\n") + "\n";
}

const GITIGNORE = "# segredos gerados pelo Vitrine Studio\n.env\nnode_modules/\ndist/\n";

function readmeAuth(plans: ServicePlan[]): string {
  const own = plans.find((p) => p.ownAuth);
  const guarded = plans.flatMap((p) => routeLines(p.node.props.routes).filter((r) => r.protected).map((r) => `\`${r.method} ${r.path}\` (${p.node.name})`));
  if (!own && !guarded.length) return "";
  const base = own ? `http://localhost:${own.port}` : "";
  return `## Autenticação

${
  own
    ? `Autenticação própria em \`services/${own.slug}/src/auth.ts\`: tabela \`users\` (email único + \`password_hash\`),
senha com scrypt do \`node:crypto\` e token JWT HS256 (\`hono/jwt\`) válido por 7 dias. A senha e o hash
nunca voltam nas respostas.

\`\`\`bash
# cadastrar (senha com 8+ caracteres) e entrar
curl -X POST ${base}/auth/register -H "content-type: application/json" -d '{"email":"ana@ex.com","password":"segredo123"}'
curl -X POST ${base}/auth/login    -H "content-type: application/json" -d '{"email":"ana@ex.com","password":"segredo123"}'
# rota protegida: sem token -> 401
curl ${base}/auth/me -H "Authorization: Bearer <token>"
\`\`\`
`
    : "As rotas protegidas validam um JWT HS256 assinado com `JWT_SECRET` (o mesmo segredo do emissor dos tokens).\n"
}
${guarded.length ? `Rotas que exigem \`Authorization: Bearer <token>\`: ${guarded.join(", ")}. Numa rota protegida que grava em tabela com chave para \`users\`, o dono vem do token.\n` : ""}
\`JWT_SECRET\` vem do \`.env\`, gerado com um valor aleatório neste export.
`;
}

export function archFiles(graph: ArchGraph, erIn: ErModel, secrets: BackendSecrets = randomSecrets()): GeneratedFile[] {
  const plans = plan(graph);
  // Auth própria garante users(email único, password_hash) no schema gerado,
  // mesmo que o canvas Banco ainda não tenha a tabela.
  const er = plans.some((p) => p.ownAuth) ? ensureAuthUsers(erIn) : erIn;
  const hasSchema = er.tables.length > 0;
  const files: GeneratedFile[] = [
    { path: "README.md", content: readme(graph, plans, hasSchema) },
    { path: "docker-compose.yml", content: compose(graph, plans, hasSchema && graph.nodes.some((n) => n.kind === "postgres")) },
    { path: ".env", content: envFile(graph, plans, secrets, true) },
    { path: ".env.example", content: envFile(graph, plans, PLACEHOLDER_SECRETS, false) },
    { path: ".gitignore", content: GITIGNORE },
    ...plans.flatMap((p) => serviceFiles(p, er)),
  ];
  if (hasSchema && graph.nodes.some((n) => n.kind === "postgres")) files.push({ path: "db/schema.postgres.sql", content: toSql(er, "postgres") });
  return files;
}
