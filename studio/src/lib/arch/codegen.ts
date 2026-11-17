// Grafo de arquitetura -> moldes de backend (Node 24 + Hono + Docker).
// Determinístico. Quando uma rota bate com uma tabela do canvas Banco e o
// serviço grava no Postgres, o handler já sai com SQL de verdade.
import { ARCH, routeLines, type ArchGraph, type ArchNode } from "./model";
import { fkColumns, pascal, snake, type ColType, type ErModel, type Table } from "@/lib/db/model";
import { toSql, type GeneratedFile } from "@/lib/db/codegen";

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
      return {
        node,
        slug,
        port: Number.isInteger(explicit) && explicit > 0 ? explicit : nextPort++,
        httpTargets: out.filter((x) => x.e.kind === "http" && ["api", "service", "external", "auth"].includes(x.t.kind)).map((x) => x.t),
        db: dbEdges[0]?.t,
        dbWrites: dbEdges.some((x) => x.e.kind === "writes"),
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

function routeHandler(p: ServicePlan, method: string, path: string, er: ErModel): string {
  const honoPath = path.replace(/\{(\w+)\}/g, ":$1");
  const table = p.db ? tableForPath(path, er) : undefined;
  const hasId = /\/:\w+|\{\w+\}/.test(path);
  const tn = table ? snake(table.name) : "";
  const publish = p.publishes[0];
  const notify = publish ? `\n  await publish("${streamName(publish)}", { type: "${tn || "evento"}.${method === "POST" ? "created" : "changed"}", data: row });` : "";

  if (table && method === "GET" && !hasId) {
    return `app.get("${honoPath}", async (c) => {
  const { rows } = await db.query('select * from "${tn}" limit 100');
  return c.json(rows);
});`;
  }
  if (table && method === "GET" && hasId) {
    return `app.get("${honoPath}", async (c) => {
  const { rows } = await db.query('select * from "${tn}" where "${snake(table.columns.find((col) => col.pk)?.name ?? "id")}" = $1', [c.req.param("${honoPath.match(/:(\w+)/)?.[1] ?? "id"}")]);
  return rows[0] ? c.json(rows[0]) : c.json({ error: "não encontrado" }, 404);
});`;
  }
  if (table && method === "POST" && p.dbWrites && !hasId && bodyFields(table, er).length) {
    return `app.post("${honoPath}", async (c) => {
  const parsed = ${schemaName(table)}.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: "Corpo inválido.", issues: issuesOf(parsed.error) }, 400);
  // Só entram colunas conhecidas pelo schema (o zod descarta o resto), então os nomes são seguros.
  const data = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  const sql = data.length
    ? \`insert into "${tn}" (\${data.map(([k]) => \`"\${k}"\`).join(", ")}) values (\${data.map((_, i) => \`$\${i + 1}\`).join(", ")}) returning *\`
    : 'insert into "${tn}" default values returning *';
  const { rows } = await db.query(sql, data.map(([, v]) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v)));
  const row = rows[0];${notify}
  return c.json(row, 201);
});`;
  }
  const verb = method.toLowerCase();
  return `app.${verb}("${honoPath}", async (c) => {
  // TODO: implemente ${method} ${path}
  return c.json({ todo: "${method} ${path}" }, 501);
});`;
}

function serviceIndex(p: ServicePlan, er: ErModel): string {
  const imports: string[] = [];
  const isHttp = p.node.kind !== "worker";
  if (isHttp) imports.push('import { Hono } from "hono";', 'import { HTTPException } from "hono/http-exception";', 'import { serve } from "@hono/node-server";');
  if (p.db) imports.push('import { db } from "./db.js";');
  const posts = isHttp ? postTables(p, er) : [];
  if (posts.length) imports.push('import type { z } from "zod";', `import { ${posts.map(schemaName).join(", ")} } from "./schemas.js";`);
  if (p.cache) imports.push('import { cache } from "./cache.js";');
  if (p.publishes.length) imports.push('import { publish } from "./queue.js";');
  if (p.consumes.length) imports.push('import { consume } from "./queue.js";');
  if (p.httpTargets.length) imports.push(`import { ${p.httpTargets.map((t) => clientFn(t)).join(", ")} } from "./clients.js";`);
  const uniqImports = [...new Set(imports)];
  const parts = [`// ${p.node.name} — gerado pelo Vitrine Studio`, ...uniqImports, ""];

  if (isHttp) {
    const routes = routeLines(p.node.props.routes);
    parts.push("const app = new Hono();", "", 'app.get("/health", (c) => c.json({ ok: true, service: "' + p.slug + '" }));', "");
    if (posts.length) parts.push(ISSUES_FN, "");
    parts.push(onErrorHandler(!!p.db), "");
    for (const r of routes.filter((r) => !(r.method === "GET" && r.path === "/health"))) parts.push(routeHandler(p, r.method, r.path, er), "");
    if (p.httpTargets.length || p.cache) {
      parts.push(
        `// Exemplo de uso das dependências ligadas no canvas:`,
        ...p.httpTargets.map((t) => `//   await ${clientFn(t)}("/caminho")  -> ${t.name}`),
        ...(p.cache ? [`//   await cache.get("chave") / cache.set("chave", valor, "EX", 60)`] : []),
        "",
      );
    }
    parts.push(
      `const port = Number(process.env.PORT ?? ${p.port});`,
      `serve({ fetch: app.fetch, port }, () => console.log(\`${p.slug} ouvindo em http://localhost:\${port}\`));`,
    );
  }
  for (const q of p.consumes) {
    parts.push(
      "",
      `await consume("${streamName(q)}", "${p.slug}", async (event) => {`,
      `  console.log("[${p.slug}] evento recebido", event);`,
      `  // TODO: processe o evento (ex.: enviar e-mail, atualizar CRM)`,
      `});`,
    );
  }
  if (!isHttp && !p.consumes.length) {
    parts.push("// Worker sem fila ligada: ligue uma Fila -> este worker no canvas.", 'setInterval(() => console.log("worker vivo"), 60_000);');
  }
  return parts.join("\n") + "\n";
}

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

function serviceFiles(p: ServicePlan, er: ErModel): GeneratedFile[] {
  const base = `services/${p.slug}`;
  const deps: Record<string, string> = {};
  const devDeps: Record<string, string> = { tsx: TEMPLATE_VERSIONS.tsx, typescript: TEMPLATE_VERSIONS.typescript, "@types/node": TEMPLATE_VERSIONS["@types/node"] };
  if (p.node.kind !== "worker") Object.assign(deps, { hono: TEMPLATE_VERSIONS.hono, "@hono/node-server": TEMPLATE_VERSIONS["@hono/node-server"] });
  if (p.db) {
    deps.pg = TEMPLATE_VERSIONS.pg;
    devDeps["@types/pg"] = TEMPLATE_VERSIONS["@types/pg"];
  }
  if (p.cache || p.publishes.length || p.consumes.length) deps.ioredis = TEMPLATE_VERSIONS.ioredis;
  const posts = p.node.kind !== "worker" ? postTables(p, er) : [];
  if (posts.length) deps.zod = TEMPLATE_VERSIONS.zod;

  const files: GeneratedFile[] = [
    {
      path: `${base}/package.json`,
      content:
        JSON.stringify(
          {
            name: p.slug,
            private: true,
            type: "module",
            scripts: { dev: "tsx watch src/index.ts", build: "tsc", start: "node dist/index.js", typecheck: "tsc --noEmit" },
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
  if (posts.length) files.push({ path: `${base}/src/schemas.ts`, content: schemasFile(posts, er) });
  if (p.db) {
    files.push({
      path: `${base}/src/db.ts`,
      content: `import pg from "pg";

export const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
`,
    });
  }
  if (p.cache) {
    files.push({
      path: `${base}/src/cache.ts`,
      content: `import { Redis } from "ioredis";

export const cache = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
`,
    });
  }
  if (p.publishes.length || p.consumes.length) {
    files.push({
      path: `${base}/src/queue.ts`,
      content: `// Fila com Redis Streams. Molde simples: sem retry nem dead-letter.
import { Redis } from "ioredis";

const redis = new Redis(process.env.QUEUE_URL ?? "redis://localhost:6379");

export async function publish(stream: string, event: unknown): Promise<void> {
  await redis.xadd(stream, "*", "data", JSON.stringify(event));
}

export async function consume(stream: string, group: string, handle: (event: unknown) => Promise<void>): Promise<never> {
  const consumer = \`\${group}-\${process.pid}\`;
  await redis.xgroup("CREATE", stream, group, "$", "MKSTREAM").catch(() => {}); // já existe
  for (;;) {
    const res = (await redis.xreadgroup("GROUP", group, consumer, "COUNT", 10, "BLOCK", 5000, "STREAMS", stream, ">")) as
      | [string, [string, string[]][]][]
      | null;
    for (const [, entries] of res ?? []) {
      for (const [id, fields] of entries) {
        await handle(JSON.parse(fields[1] ?? "null"));
        await redis.xack(stream, group, id);
      }
    }
  }
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
  const routes = routeLines(p.node.props.routes);
  const byPath = new Map<string, string[]>();
  for (const r of routes) byPath.set(r.path, [...(byPath.get(r.path) ?? []), r.method]);
  if (!byPath.has("/health")) byPath.set("/health", ["GET"]);
  const lines = ["openapi: 3.1.0", "info:", `  title: ${JSON.stringify(p.node.name)}`, "  version: 0.1.0", "servers:", `  - url: http://localhost:${p.port}`, "paths:"];
  for (const [path, methods] of byPath) {
    lines.push(`  ${path.replace(/:(\w+)/g, "{$1}")}:`);
    for (const m of methods) {
      lines.push(`    ${m.toLowerCase()}:`, `      summary: ${m} ${path}`, "      responses:", `        "${m === "POST" ? "201" : "200"}":`, "          description: OK");
    }
  }
  return lines.join("\n") + "\n";
}

function compose(graph: ArchGraph, plans: ServicePlan[], hasSchema: boolean): string {
  const lines = ["# Gerado pelo Vitrine Studio", "services:"];
  const pg = graph.nodes.find((n) => n.kind === "postgres");
  const needsRedis = graph.nodes.some((n) => n.kind === "cache" || n.kind === "queue");
  const storage = graph.nodes.find((n) => n.kind === "storage");
  for (const p of plans) {
    lines.push(`  ${p.slug}:`, `    build: ./services/${p.slug}`);
    if (p.node.kind !== "worker") lines.push("    ports:", `      - "${p.port}:${p.port}"`);
    const env = p.node.kind === "worker" ? [] : [`PORT: "${p.port}"`];
    if (p.db) env.push(`DATABASE_URL: postgres://app:app@postgres:5432/${dbName(p.db)}`);
    if (p.cache) env.push("REDIS_URL: redis://redis:6379");
    if (p.publishes.length || p.consumes.length) env.push("QUEUE_URL: redis://redis:6379");
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
      "      POSTGRES_PASSWORD: app",
      `      POSTGRES_DB: ${dbName(pg)}`,
      "    ports:",
      '      - "5432:5432"',
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
      '      - "6379:6379"',
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
      "      MINIO_ROOT_PASSWORD: minio12345",
      "    ports:",
      '      - "9000:9000"',
      '      - "9001:9001"',
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
## Rodar um serviço sem Docker

\`\`\`bash
cd services/<nome>
npm install
npm run dev
\`\`\`

Variáveis de ambiente: veja \`.env.example\`.
`;
}

function envExample(graph: ArchGraph, plans: ServicePlan[]): string {
  const lines = ["# Variáveis usadas pelos serviços (valores para rodar fora do Docker)"];
  const pgNode = graph.nodes.find((n) => n.kind === "postgres");
  if (pgNode) lines.push(`DATABASE_URL=postgres://app:app@localhost:5432/${dbName(pgNode)}`);
  if (graph.nodes.some((n) => n.kind === "cache")) lines.push("REDIS_URL=redis://localhost:6379");
  if (graph.nodes.some((n) => n.kind === "queue")) lines.push("QUEUE_URL=redis://localhost:6379");
  const targets = new Map<string, string>();
  for (const p of plans) for (const t of p.httpTargets) {
    const tp = plans.find((x) => x.node.id === t.id);
    targets.set(`${envName(t)}_URL`, tp ? `http://localhost:${tp.port}` : t.props.url || t.props.issuer || "");
  }
  for (const [k, v] of targets) lines.push(`${k}=${v}`);
  if (graph.nodes.some((n) => n.kind === "storage")) lines.push("S3_ENDPOINT=http://localhost:9000", "S3_BUCKET=uploads");
  return lines.join("\n") + "\n";
}

export function archFiles(graph: ArchGraph, er: ErModel): GeneratedFile[] {
  const plans = plan(graph);
  const hasSchema = er.tables.length > 0;
  const files: GeneratedFile[] = [
    { path: "README.md", content: readme(graph, plans, hasSchema) },
    { path: "docker-compose.yml", content: compose(graph, plans, hasSchema && graph.nodes.some((n) => n.kind === "postgres")) },
    { path: ".env.example", content: envExample(graph, plans) },
    ...plans.flatMap((p) => serviceFiles(p, er)),
  ];
  if (hasSchema && graph.nodes.some((n) => n.kind === "postgres")) files.push({ path: "db/schema.postgres.sql", content: toSql(er, "postgres") });
  return files;
}
