# Codegen research: architecture graph -> backend scaffold, ER model -> DB artifacts

Date: 2026-11-17. Target: "vitrine-studio" greenfield project.
Legend: **VERIFIED (how)** = checked via `npm view` (version, license, engines, unpacked size, deps) today. **ASSUMED** = design decision or unverified claim; validate in a spike.
NOT done in this pass: reading Prisma/Drizzle/DBML/Hono/zod docs, A2UI spec, FastAPI PyPI, bundling. Every API-shape claim about those is ASSUMED.

---

## 0. Recommendations (short)

1. Deterministic codegen for everything that must be valid (folders, DDL, Prisma/Drizzle/DBML text, compose, route stubs, lint rules). The LLM emits only IR JSON (zod-validated) and optional handler bodies/names/index suggestions. This keeps the mock/local model working offline and makes outputs golden-testable.
2. Default backend template: Node 24 + Hono 4.13.19 + @hono/node-server 2.1.9 + zod 4.6.7 + pg 8.23.1. Secondary (v1.1): Fastify 5.12.8. Express 5.3.0 and @nestjs/core 12.5.1 are heavier options. FastAPI is the only candidate non-Node secondary, deferred.
3. Emit DB text with our own string templates. Browser libs: `sql-formatter` (formatting DDL), `yaml` (compose), `fflate` (zip). `@dbml/core` only lazily, as optional importer/validator (36.9 MB unpacked). `@mrleebo/prisma-ast` only if we must parse/merge existing Prisma files.
4. Link artifacts by stable ids in one `ProjectModel`: landing element -> endpoint -> arch node -> entity.
5. Review panel = pure rule engine over IR (rules in section 5).

---

## 1. Deterministic vs LLM split

| Concern | Owner | Why |
|---|---|---|
| IR validation (zod) | Deterministic | Gates everything |
| Lint rules (sec. 5) | Deterministic | Explainable, testable, offline |
| Folder tree, package.json, tsconfig, Dockerfile, compose, .env.example | Template | Always compiles |
| Service entrypoints, route stubs, queue consumer stubs | Template parameterized by IR | Stable shape |
| Route handler business logic | LLM optional, `// TODO` fallback | Only place LLM adds real value |
| DDL / Prisma / Drizzle / DBML text | String emitters | Dialect-golden tests |
| OpenAPI skeleton | Derived from routes (emit YAML ourselves) | Deterministic |
| Naming (tables/services from landing copy) | LLM proposes, normalizer enforces snake_case/plural | LLM good at names, normalizer guarantees validity |
| Entities/endpoints from a landing page ("Reimaginar") | LLM proposes JSON draft, zod validates; never code | Core AI step |
| Index suggestions | Heuristic first (FK cols without index, `*_id`, `email`, `slug`); LLM may add | Testable baseline |
| Architecture review prose | Rules first; LLM prose optional | Review panel must work offline |

Rule: **the LLM emits data (validated JSON); generators emit code/text.** The "Reimaginar" feature has a deterministic fallback so it works with no model at all.

Pipeline:
```
graph UI  -> ArchitectureGraph (zod) -> lint -> scaffold files -> zip
ER UI     -> ErModel (zod)           -> lint -> DDL/Prisma/Drizzle/DBML -> zip
landing   -> [LLM | mock | heuristic] -> ProjectDraft (zod, strict) -> user accepts per item -> same pipeline
```

---

## 2. Target stacks

VERIFIED via `npm view <pkg> version license engines` (2026-11-17):

| Package | Latest | License | engines |
|---|---|---|---|
| hono | 4.13.19 | MIT | node >=16.9.0 |
| @hono/node-server | 2.1.9 | MIT | — |
| fastify | 5.12.8 | MIT | >=20 |
| express | 5.3.0 | MIT | >=18 |
| @nestjs/core | 12.5.1 | MIT | >=22 |
| zod | 4.6.7 | MIT | — |
| pg | 8.23.1 | MIT | — |
| ioredis | 6.0.0 | MIT | — |
| tsx | 4.23.15 | MIT | — |
| typescript | 7.0.2 | Apache-2.0 | — (TS 5.x line NOT verified in this pass) |
| @types/node | 26.6.6 (also 24.19.2 exists) | MIT | — |
| drizzle-orm | 0.45.4 | Apache-2.0 | peer: pg, gel, knex, kysely... |
| drizzle-kit | 0.31.11 | MIT | — |
| prisma | 8.0.0-rc.34 (prerelease, `latest` tag) | Apache-2.0 | — (pin a stable 6.x/7.x instead; check `npm view prisma dist-tags`, ASSUMED) |
| FastAPI (PyPI) | not checked | MIT (ASSUMED) | — |

### 2.1 Choice
- **Default: Hono.** Web-standard Request/Response, tiny, runs on Node/Bun/Deno/Workers so one template can retarget later, and zod validators pair directly with the same zod schemas used for IR.
- **Secondary: Fastify.** Excellent, but JSON-Schema-first; zod -> JSON Schema would be a second source of truth. Only one secondary in v1.
- Express: familiar but untyped by default. Nest: too much scaffold for a "molde". FastAPI: after the Node path is stable.

### 2.2 Minimal file set (default template, example = web -> api -> {postgres, queue -> worker -> postgres, mailer})

```
vitrine-backend/
  README.md
  .env.example
  docker-compose.yml
  openapi.yaml
  services/api/{package.json,tsconfig.json,Dockerfile,src/index.ts,src/db.ts,src/queue.ts,src/routes/leads.ts}
  services/worker/{package.json,tsconfig.json,Dockerfile,src/index.ts,src/db.ts,src/consumers/lead-created.ts}
```
Rules: `db.ts` only when a node has `reads|writes` to a relational-db; `queue.ts` only when an event edge touches a queue; `MAILER_BASE_URL` env only when an external-api edge exists.

**services/api/package.json**
```json
{
  "name": "api",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24" },
  "scripts": { "dev": "tsx watch src/index.ts", "build": "tsc -p tsconfig.json", "start": "node dist/index.js" },
  "dependencies": {
    "hono": "4.13.19",
    "@hono/node-server": "2.1.9",
    "zod": "4.6.7",
    "pg": "8.23.1",
    "ioredis": "6.0.0"
  },
  "devDependencies": {
    "@types/node": "24.19.2",
    "@types/pg": "8.23.1",
    "tsx": "4.23.15",
    "typescript": "ASSUMED-5.x (verify; 7.0.2 exists)"
  }
}
```

**services/api/tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2023", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "outDir": "dist", "rootDir": "src", "skipLibCheck": true
  },
  "include": ["src"]
}
```

**services/api/src/index.ts**
```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { leadsRoutes } from "./routes/leads.js";

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));
app.route("/leads", leadsRoutes);

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`api listening on :${info.port}`);
});
```

**services/api/src/routes/leads.ts** (from edge `web -http POST /leads-> api`, and `api -writes leads-> pg`)
```ts
import { Hono } from "hono";
import { z } from "zod";
import { pool } from "../db.js";
import { publishLeadCreated } from "../queue.js";

export const leadsRoutes = new Hono();

const CreateLeadBody = z.object({
  email: z.email(),                       // zod 4 top-level form (ASSUMED valid; verify)
  name: z.string().min(1).max(200).optional(),
});

leadsRoutes.post("/", async (c) => {
  const parsed = CreateLeadBody.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues }, 400);
  const { rows } = await pool.query(
    "insert into leads (email, name) values ($1, $2) returning id, email, name, created_at",
    [parsed.data.email, parsed.data.name ?? null],
  );
  await publishLeadCreated(rows[0]);
  return c.json(rows[0], 201);
});
```

**services/api/src/db.ts**
```ts
import pg from "pg";
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
```

**services/api/src/queue.ts** (Redis Streams; ASSUMED ioredis v6 keeps `xadd`)
```ts
import { Redis } from "ioredis";
const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");
export async function publishLeadCreated(payload: unknown) {
  await redis.xadd("jobs", "*", "type", "lead.created", "payload", JSON.stringify(payload));
}
```

**services/worker/src/index.ts** (stub: no consumer groups, no ack; production must use XREADGROUP)
```ts
import { Redis } from "ioredis";
import { handlers } from "./consumers/lead-created.js";

const redis = new Redis(process.env.REDIS_URL ?? "redis://redis:6379");

async function loop(lastId = "$") {
  for (;;) {
    const res = await redis.xread("BLOCK", 5000, "STREAMS", "jobs", lastId);
    if (!res) continue;
    for (const [, messages] of res) {
      for (const [id, fields] of messages) {
        const type = fields[1];              // flat [k1,v1,k2,v2]
        await handlers[type]?.(JSON.parse(fields[3]));
        lastId = id;
      }
    }
  }
}
loop();
```

**services/worker/src/consumers/lead-created.ts**
```ts
export const handlers: Record<string, (payload: unknown) => Promise<void>> = {
  "lead.created": async (payload) => {
    // TODO: call external-api "mailer" (MAILER_BASE_URL)
    console.log("lead.created", payload);
  },
};
```

**services/api/Dockerfile** (ASSUMED `node:24-alpine` tag exists; verify)
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```
(worker Dockerfile: identical except `CMD ["node","dist/index.js"]` and no EXPOSE.)

**docker-compose.yml** (ASSUMED image tags `postgres:17-alpine`, `redis:7-alpine` exist)
```yaml
name: vitrine-backend
services:
  api:
    build: ./services/api
    env_file: .env
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
  worker:
    build: ./services/worker
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
  postgres:
    image: postgres:17-alpine
    environment: { POSTGRES_USER: app, POSTGRES_PASSWORD: app, POSTGRES_DB: app }
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d app"]
      interval: 5s
      retries: 10
    volumes: ["pgdata:/var/lib/postgresql/data"]
  redis:
    image: redis:7-alpine
volumes:
  pgdata: {}
```

**.env.example**
```
DATABASE_URL=postgres://app:app@postgres:5432/app
REDIS_URL=redis://redis:6379
PORT=3000
MAILER_BASE_URL=https://mailer.example.invalid
```

---

## 3. Browser-side libraries

VERIFIED = npm metadata (version, license, unpacked size, deps). Browser behaviour = ASSUMED unless stated.

| Package | Version | License | Unpacked size | Notes | Role |
|---|---|---|---|---|---|
| @dbml/core | 12.1.0 | Apache-2.0 | 36,887,380 B | `module`/`main` only, no `browser` field. Deps: luxon, antlr4, lodash, lodash-es, parsimmon, pluralize, @dbml/parse | Lazy-loaded optional importer/validator |
| @dbml/parse | 12.1.0 | Apache-2.0 | not measured | Same family, parser only (ASSUMED lighter) | Alternative if we only parse |
| @prisma/prisma-schema-wasm | 8.1.0-2.59be4fda... (prerelease) | Apache-2.0 | 3,191,620 B | WASM; ASSUMED usable in browser after init | Optional lazy validator/formatter; pin exact |
| @prisma/internals | 7.10.1 | Apache-2.0 | not measured | Node CLI internals | Do not use in browser |
| @mrleebo/prisma-ast | 0.16.0 | MIT | 518,896 B | Pure JS; deps chevrotain ^12, lilconfig ^2 | Parse/modify existing Prisma files only |
| sql-formatter | 15.9.0 | MIT | 3,128,873 B | deps nearley, argparse; ASSUMED browser-OK | Pretty-print DDL (lazy) |
| yaml | 2.9.1 | ISC | 796,742 B | Pure JS | Compose/YAML output (recommended over js-yaml) |
| js-yaml | 5.5.0 | MIT | 686,297 B | Pure JS | Alternative |
| fflate | 0.8.3 | MIT | 41,990 B | Browser + Node, zip | **Recommended zip** |
| client-zip | 2.5.1 | MIT | not measured | Browser streams | Alternative |
| jszip | 3.10.2 | MIT OR GPL-3.0-or-later | not measured | Dual license | Avoid |
| openapi-types | 12.1.3 | MIT | not measured | Types only, last published 2023-05-24 | Types only, or emit YAML ourselves |
| node-sql-parser | 5.4.0 | Apache-2.0 | not measured | ASSUMED browser-OK | Optional DDL round-trip check |

v1 browser bundle: zod, fflate, yaml, sql-formatter (lazy), @dbml/core (lazy, only on import/validate), prisma-schema-wasm (lazy, optional). Measure minified+gzip before committing (ASSUMED sizes differ a lot from unpacked sizes).

---

## 4. Type mapping (neutral -> dialects)

| Neutral | PostgreSQL | MySQL 8 | SQLite | Prisma (@db.* for pg) | Drizzle pg-core |
|---|---|---|---|---|---|
| uuid | uuid | CHAR(36) | TEXT | String @db.Uuid | uuid() |
| text | text | TEXT | TEXT | String | text() |
| varchar(n) | varchar(n) | VARCHAR(n) | TEXT | String @db.VarChar(n) | varchar({length:n}) |
| int | integer | INT | INTEGER | Int | integer() |
| bigint | bigint | BIGINT | INTEGER | BigInt | bigint({mode:"number"}) |
| decimal(p,s) | numeric(p,s) | DECIMAL(p,s) | NUMERIC | Decimal @db.Decimal(p,s) | numeric({precision:p,scale:s}) |
| boolean | boolean | BOOLEAN | INTEGER 0/1 | Boolean | boolean() |
| timestamp(tz) | timestamptz | DATETIME(3) | TEXT ISO-8601 | DateTime @db.Timestamptz(6) | timestamp({withTimezone:true}) |
| date | date | DATE | TEXT | DateTime @db.Date | date() |
| json | jsonb | JSON | TEXT | Json | jsonb() |
| enum | CREATE TYPE ... AS ENUM | ENUM(...) inline | TEXT + CHECK IN (...) | enum block | pgEnum() |

Keys and relations (ASSUMED standard SQL semantics; verify against PostgreSQL 17 docs):
- PK: `PRIMARY KEY (a[, b])`. Composite allowed.
- FK: `REFERENCES parent (id) ON DELETE <a> ON UPDATE <a>`; actions NO ACTION | RESTRICT | CASCADE | SET NULL | SET DEFAULT. Default: update NO ACTION, delete RESTRICT, CASCADE only for owned children.
- Unique: column `UNIQUE` or `UNIQUE (a,b)`; Prisma `@unique` / `@@unique([a,b])`; Drizzle `.unique()`.
- Index: `CREATE INDEX idx_<t>_<cols> ON <t> (<cols>)`; Prisma `@@index`; Drizzle `index().on()`.
- Many-to-many: explicit join table `<a>_<b>` with PK `(a_id, b_id)`, both FKs `ON DELETE CASCADE`. Emit explicit join model even in Prisma (deterministic).
- Reserved words: quote identifiers (`"x"` pg/sqlite, backticks mysql); Prisma `@@map`/`@map`.

---

## 5. Validation rules (non-AI review panel)

### 5.1 ArchitectureGraph
| id | sev | rule | fix hint |
|---|---|---|---|
| G001 | error | edge from/to references missing node (dangling) | remove edge or add node |
| G002 | error | self-loop (except event producer/consumer pattern) | split node |
| G003 | error | node declares `dataAccess: [X]` (or `writes` edge) but no matching edge to a data node | add edge |
| G004 | error | cycle in synchronous edges (http/grpc/sync reads) | make one leg event |
| G005 | warn | public client->api edge, api has `auth: none` | add auth provider or mark intentional |
| G006 | warn | public endpoint has no rate limit/auth flag | add policy |
| G007 | warn | queue without producer or consumer | connect |
| G008 | info | orphan node (no edges) | remove or connect |
| G009 | error | node type not in catalog | fix type |
| G010 | error | duplicate node id | rename |
| G011 | warn | two services write the same relational table | assign owner |
| G012 | info | external-api without timeout/retry policy | add policy |

Detection notes: G004 = Tarjan SCC over edges whose kind is http/grpc (and sync reads); any SCC of size > 1 or self-loop is an error. G003: keep `dataAccess` on the node as the source of truth and derive edges from it, so G003 fires only for hand-edited inconsistent IR.

### 5.2 ErModel
| id | sev | rule |
|---|---|---|
| E001 | error | table without primary key |
| E002 | error | FK column type != referenced PK type |
| E003 | warn | orphan table (no FK in/out, not `standalone: true`) |
| E004 | error | reserved word as table/column name (per-dialect list; ASSUMED list, verify with PG17 keyword appendix) |
| E005 | warn | not snake_case / plural tables |
| E006 | warn | FK column without index |
| E007 | error | nullable column in PK |
| E008 | warn | varchar without length |
| E009 | error | money-like name (`price`,`amount`,`total`) without decimal(p,s) |
| E010 | warn | `*_at` column without timezone |
| E011 | error | duplicate table/column name |
| E012 | error | many-to-many without join table |
| E013 | warn | `set-null` on NOT NULL FK |
| E014 | info | no `created_at` |
| E015 | error | enum default not in values |

---

## 6. Linking landing -> API -> service -> tables

ProjectModel (zod): `{ landing?, graph: ArchitectureGraph, er: ErModel, links: Link[] }`, `Link = { from: {kind,id}, to: {kind,id}, rel: "submits"|"calls"|"handledBy"|"writes"|"maps" }`. All ids stable, generated once, never derived from display names.

Example chain (lead capture):
1. Landing: form `lead-capture` with `email` (required), `name` (optional), CTA "Quero acesso".
2. Link `submits`: form `lead-capture` -> endpoint `POST /leads`.
3. Link `handledBy`: endpoint -> arch node `api`.
4. Edge `writes`: `api` -> entity `leads`.
5. Entity `leads`: `id uuid pk`, `email varchar(320) unique not null`, `name varchar(200) null`, `created_at timestamptz not null default now()`.
6. Link `maps`: form field `email` -> column `leads.email`, `name` -> `leads.name`. The route's zod body is derived from these maps, not from free LLM text.

"Reimaginar" step (landing -> draft):
- Model returns `ProjectDraft` JSON only, validated by a `.strict()` zod schema. No code, HTML or SQL. Retry once with the zod error on failure; then fall back to deterministic inference: a form with an `email` field -> `POST /<slug>` + table `<slug>`; a CTA linking `/checkout` -> `POST /checkout` + table `orders`.
- UI shows the draft as a diff; the user accepts per item. Mock model returns a fixture; heuristic fallback needs no model.

---

## 7. Zod schemas and worked examples

### 7.1 ArchitectureGraph (zod 4 syntax, ASSUMED to compile)

```ts
import { z } from "zod";

export const NodeType = z.enum([
  "client", "api", "service", "worker", "queue", "cache",
  "relational-db", "object-storage", "external-api", "auth-provider",
]);
export const EdgeKind = z.enum(["http", "grpc", "event", "reads", "writes"]);

export const ArchNode = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
  type: NodeType,
  label: z.string().min(1).max(80),
  dataAccess: z.array(z.string()).default([]),       // entity ids
  public: z.boolean().default(false),
  auth: z.enum(["none", "jwt", "session", "api-key"]).default("none"),
  stack: z.enum(["hono", "fastify", "express", "nest", "fastapi"]).optional(),
}).strict();

export const ArchEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  kind: EdgeKind,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
  path: z.string().startsWith("/").optional(),
  topic: z.string().optional(),                      // event: queue topic/stream
  entity: z.string().optional(),                     // reads/writes: ER table id
}).strict();

export const ArchitectureGraph = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  nodes: z.array(ArchNode).min(1),
  edges: z.array(ArchEdge),
}).strict();
export type ArchitectureGraph = z.infer<typeof ArchitectureGraph>;
```

Worked example:
```json
{
  "version": 1,
  "name": "vitrine-leads",
  "nodes": [
    { "id": "web", "type": "client", "label": "Landing", "public": true },
    { "id": "api", "type": "api", "label": "Leads API", "public": true, "stack": "hono", "dataAccess": ["leads"] },
    { "id": "worker", "type": "worker", "label": "Lead worker", "stack": "hono", "dataAccess": ["leads"] },
    { "id": "jobs", "type": "queue", "label": "jobs stream" },
    { "id": "pg", "type": "relational-db", "label": "Postgres" },
    { "id": "mailer", "type": "external-api", "label": "Mailer" }
  ],
  "edges": [
    { "id": "e1", "from": "web", "to": "api", "kind": "http", "method": "POST", "path": "/leads" },
    { "id": "e2", "from": "api", "to": "pg", "kind": "writes", "entity": "leads" },
    { "id": "e3", "from": "api", "to": "jobs", "kind": "event", "topic": "lead.created" },
    { "id": "e4", "from": "jobs", "to": "worker", "kind": "event", "topic": "lead.created" },
    { "id": "e5", "from": "worker", "to": "pg", "kind": "reads", "entity": "leads" },
    { "id": "e6", "from": "worker", "to": "mailer", "kind": "http", "method": "POST", "path": "/send" }
  ]
}
```
Convention (ASSUMED, design choice): queue producers point into the queue, consumers are pointed to from the queue. Lint G005 fires on e1 (public, `auth: none`) unless acknowledged.

Generated outputs for this graph: `services/api/src/{index.ts, routes/leads.ts (e1), db.ts (e2), queue.ts (e3)}`; `services/worker/src/{index.ts, consumers/lead-created.ts (e4), db.ts (e5)}`; mailer client using `MAILER_BASE_URL` (e6); `docker-compose.yml` (api, worker, postgres, redis); `.env.example`; `openapi.yaml` with `POST /leads`; `README.md` with a Mermaid graph (ASSUMED Mermaid renders on GitHub).

### 7.2 ErModel (zod 4 syntax, ASSUMED to compile)

```ts
import { z } from "zod";

const FkAction = z.enum(["no-action", "restrict", "cascade", "set-null", "set-default"]);

export const NeutralType = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("uuid") }),
  z.object({ kind: z.literal("text") }),
  z.object({ kind: z.literal("varchar"), length: z.number().int().positive() }),
  z.object({ kind: z.literal("int") }),
  z.object({ kind: z.literal("bigint") }),
  z.object({ kind: z.literal("decimal"), precision: z.number().int().positive(), scale: z.number().int().min(0) }),
  z.object({ kind: z.literal("boolean") }),
  z.object({ kind: z.literal("timestamp"), tz: z.boolean().default(true) }),
  z.object({ kind: z.literal("date") }),
  z.object({ kind: z.literal("json") }),
  z.object({ kind: z.literal("enum"), name: z.string(), values: z.array(z.string()).min(1) }),
]);

export const Column = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
  type: NeutralType,
  nullable: z.boolean().default(false),
  unique: z.boolean().default(false),
  indexed: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(), // literal only, no raw SQL
  defaultFn: z.enum(["now", "gen_uuid"]).optional(),                           // symbolic
}).strict();

export const Table = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/),
  columns: z.array(Column).min(1),
  primaryKey: z.array(z.string()).min(1),
  uniques: z.array(z.array(z.string()).min(1)).default([]),
  indexes: z.array(z.array(z.string()).min(1)).default([]),
  standalone: z.boolean().default(false),
  archNodeId: z.string().optional(),
}).strict();

export const Relation = z.object({
  id: z.string(),
  from: z.object({ table: z.string(), columns: z.array(z.string()).min(1) }),
  to: z.object({ table: z.string(), columns: z.array(z.string()).min(1) }),
  cardinality: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
  onDelete: FkAction.default("restrict"),
  onUpdate: FkAction.default("no-action"),
  joinTable: z.string().optional(),
}).strict();

export const ErModel = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(80),
  dialect: z.enum(["postgres", "mysql", "sqlite"]).default("postgres"),
  tables: z.array(Table).min(1),
  relations: z.array(Relation).default([]),
}).strict();
export type ErModel = z.infer<typeof ErModel>;
```

Worked example:
```json
{
  "version": 1,
  "name": "vitrine-leads",
  "dialect": "postgres",
  "tables": [
    {
      "id": "leads", "primaryKey": ["id"], "archNodeId": "api",
      "columns": [
        { "name": "id", "type": { "kind": "uuid" }, "defaultFn": "gen_uuid" },
        { "name": "email", "type": { "kind": "varchar", "length": 320 }, "unique": true },
        { "name": "name", "type": { "kind": "varchar", "length": 200 }, "nullable": true },
        { "name": "source_campaign_id", "type": { "kind": "uuid" }, "nullable": true, "indexed": true },
        { "name": "created_at", "type": { "kind": "timestamp", "tz": true }, "defaultFn": "now" }
      ]
    },
    {
      "id": "campaigns", "primaryKey": ["id"],
      "columns": [
        { "name": "id", "type": { "kind": "uuid" }, "defaultFn": "gen_uuid" },
        { "name": "slug", "type": { "kind": "varchar", "length": 80 }, "unique": true },
        { "name": "created_at", "type": { "kind": "timestamp", "tz": true }, "defaultFn": "now" }
      ]
    }
  ],
  "relations": [
    {
      "id": "lead_campaign",
      "from": { "table": "leads", "columns": ["source_campaign_id"] },
      "to": { "table": "campaigns", "columns": ["id"] },
      "cardinality": "one-to-many",
      "onDelete": "set-null", "onUpdate": "no-action"
    }
  ]
}
```

Generated PostgreSQL DDL (deterministic template, ASSUMED `gen_random_uuid()` built-in since PG13):
```sql
CREATE TABLE "campaigns" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "slug" varchar(80) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "campaigns_slug_key" UNIQUE ("slug")
);

CREATE TABLE "leads" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "email" varchar(320) NOT NULL,
  "name" varchar(200),
  "source_campaign_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "leads_email_key" UNIQUE ("email"),
  CONSTRAINT "leads_source_campaign_id_fkey" FOREIGN KEY ("source_campaign_id")
    REFERENCES "campaigns" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);
CREATE INDEX "leads_source_campaign_id_idx" ON "leads" ("source_campaign_id");
```

Generated Prisma (ASSUMED syntax; verify on the chosen Prisma version):
```prisma
model Campaign {
  id        String   @id @default(uuid()) @db.Uuid
  slug      String   @unique @db.VarChar(80)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  leads     Lead[]

  @@map("campaigns")
}

model Lead {
  id               String    @id @default(uuid()) @db.Uuid
  email            String    @unique @db.VarChar(320)
  name             String?   @db.VarChar(200)
  sourceCampaignId String?   @map("source_campaign_id") @db.Uuid
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  sourceCampaign   Campaign? @relation(fields: [sourceCampaignId], references: [id], onDelete: SetNull)

  @@index([sourceCampaignId])
  @@map("leads")
}
```
(Singularization: use a fixed rule or the `pluralize` package, ASSUMED v8.)

Generated Drizzle pg-core (ASSUMED helper names; verify against drizzle-orm 0.45.4 d.ts):
```ts
import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 200 }),
  sourceCampaignId: uuid("source_campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("leads_source_campaign_id_idx").on(t.sourceCampaignId)]);
```

Generated DBML (ASSUMED syntax; can be checked with lazily loaded @dbml/core):
```dbml
Table campaigns {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  slug varchar(80) [unique, not null]
  created_at timestamptz [not null, default: `now()`]
}

Table leads {
  id uuid [pk, not null, default: `gen_random_uuid()`]
  email varchar(320) [unique, not null]
  name varchar(200)
  source_campaign_id uuid [ref: > campaigns.id, note: 'ON DELETE SET NULL']
  created_at timestamptz [not null, default: `now()`]
}
```

CRUD route stub linked to service `api` (generated only when the table is linked to an arch node with an endpoint):
```ts
leadsRoutes.get("/:id", async (c) => {
  const { rows } = await pool.query("select id, email, name, created_at from leads where id = $1", [c.req.param("id")]);
  return rows[0] ? c.json(rows[0]) : c.json({ error: "not_found" }, 404);
});
```
Column exposure: `source_campaign_id` is omitted here by an `exposed` flag to add in v1.1 (ASSUMED design).

---

## 8. Open spikes before v1

1. Generate section 2.2 project; run `npm install`, `tsc`, `docker compose up` on Node 24. Confirms hono/ioredis/zod 4 API assumptions.
2. Verify `typescript@5.x` pin and `npm view typescript@7.0.2` CLI compatibility.
3. Prisma: pick a stable release (`npm view prisma dist-tags`); the `latest` tag is 8.0.0-rc.34 prerelease.
4. Measure minified+gzip for @dbml/core and @prisma/prisma-schema-wasm in a Vite build.
5. Queue default: Redis Streams (chosen here) vs Postgres table as queue (one fewer container).
6. FastAPI: verify PyPI version and Python 3.12 support before v1.1.
7. Per-dialect reserved-word lists from PostgreSQL 17 and MySQL 8 keyword appendices.
8. Confirm zod 4.6.7 APIs used (`z.email()`, `z.discriminatedUnion`, `.strict()`).

## 9. Limits

- No websites were read today. Prisma, Drizzle, DBML, Hono, ioredis, zod, and A2UI API shapes are ASSUMED.
- VERIFIED only: versions, licenses, engines, unpacked sizes and declared dependencies from npm.
- Code blocks are illustrative and not compiled.
