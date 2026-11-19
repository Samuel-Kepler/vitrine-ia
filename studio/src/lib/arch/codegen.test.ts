import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { starterDraft } from "@/lib/draft/starter";
import { createNode } from "@/lib/draft/tree";
import { inferFromDraft } from "@/lib/infer/from-draft";
import { expandArch, expandDb } from "@/lib/infer/expand";
import { archFiles } from "./codegen";
import { dbFiles, toSql } from "@/lib/db/codegen";
import { reviewArch, reviewDb } from "@/lib/review/rules";

function sample() {
  const draft = [...starterDraft(), createNode("pricing"), createNode("pricing"), createNode("testimonial")];
  const s = inferFromDraft(draft, "clientes fazem login na área do cliente");
  return { graph: expandArch(s.arch), er: expandDb(s.db), notes: s.notes };
}

describe("inferência + codegen", () => {
  it("landing com formulário e planos vira API, fila, worker e tabelas ligadas", () => {
    const { graph, er } = sample();
    expect(graph.nodes.map((n) => n.kind)).toEqual(expect.arrayContaining(["web", "api", "queue", "worker", "postgres", "external", "auth"]));
    expect(er.tables.map((t) => t.name)).toEqual(expect.arrayContaining(["leads", "plans", "subscriptions", "testimonials", "users"]));
    expect(reviewDb(er).filter((f) => f.severity === "error")).toEqual([]);
    expect(reviewArch(graph, er).filter((f) => f.severity === "error")).toEqual([]);
  });

  it("gera serviços com CRUD real para rotas que batem com tabelas", () => {
    const { graph, er } = sample();
    const files = archFiles(graph, er);
    const paths = files.map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(["docker-compose.yml", ".env.example", "README.md", "services/api/src/index.ts", "services/api/src/db.ts", "services/api/src/queue.ts", "services/notificacoes/src/index.ts", "db/schema.postgres.sql"]));
    const api = files.find((f) => f.path === "services/api/src/index.ts")!.content;
    expect(api).toContain('insert into "leads"');
    expect(api).toContain('await publish("eventos"');
    expect(files.find((f) => f.path === "docker-compose.yml")!.content).toContain("postgres:17-alpine");
  });

  it("POST valida o corpo com zod derivado das colunas e mapeia erros do Postgres", async () => {
    const { graph, er } = sample();
    const files = archFiles(graph, er);
    const api = files.find((f) => f.path === "services/api/src/index.ts")!.content;
    const schemas = files.find((f) => f.path === "services/api/src/schemas.ts")!.content;
    expect(api).toContain("LeadsInput.safeParse");
    expect(api).toContain('"23505"');
    expect(api).toMatch(/409/);
    expect(JSON.parse(files.find((f) => f.path === "services/api/package.json")!.content).dependencies.zod).toBeTruthy();

    // Executa o schema gerado (com o zod v4 do próprio studio).
    const z = await import("zod/v4");
    const body = schemas.replace(/^import .*$/m, "").replace(/export const (\w+) =/g, "out.$1 =");
    const out: Record<string, { safeParse(v: unknown): { success: boolean } }> = {};
    new Function("z", "out", body)(z, out);
    expect(out.LeadsInput.safeParse({ nome: "Ana", email: "ana@ex.com" }).success).toBe(true);
    expect(out.LeadsInput.safeParse({ nome: "", email: "ana@ex.com" }).success).toBe(false);
    expect(out.LeadsInput.safeParse({ nome: "Ana", email: "não-é-email" }).success).toBe(false);
    expect(out.LeadsInput.safeParse({ email: "ana@ex.com" }).success).toBe(false);
    expect(out.LeadsInput.safeParse(undefined).success).toBe(false);
  });

  it("compose espera Postgres/Redis saudáveis e o Dockerfile roda sem root", () => {
    const { graph, er } = sample();
    const files = archFiles(graph, er);
    const compose = files.find((f) => f.path === "docker-compose.yml")!.content;
    expect(compose).toContain("pg_isready -U app -d app");
    expect(compose).toContain('test: ["CMD", "redis-cli", "ping"]');
    expect(compose).toMatch(/api:[\s\S]*?postgres:\n\s+condition: service_healthy[\s\S]*?redis:\n\s+condition: service_healthy/);
    expect(compose).not.toMatch(/depends_on:\n\s+- /);
    const docker = files.find((f) => f.path === "services/api/Dockerfile")!.content;
    expect(docker).toContain("FROM node:24-alpine AS build");
    expect(docker).toContain("npm ci");
    expect(docker).toContain("USER node");
    expect(docker).toContain("npm prune --omit=dev");
    expect(files.find((f) => f.path === "README.md")!.content).toContain("docker compose down -v");
  });

  it("healthcheck, POSTGRES_DB e DATABASE_URL usam o nome do banco do canvas", () => {
    const { graph, er } = sample();
    graph.nodes.find((n) => n.kind === "postgres")!.props.database = "Loja Café";
    const files = archFiles(graph, er);
    const compose = files.find((f) => f.path === "docker-compose.yml")!.content;
    expect(compose).toContain("POSTGRES_DB: loja_cafe");
    expect(compose).toContain("pg_isready -U app -d loja_cafe");
    expect(compose).toContain("@postgres:5432/loja_cafe");
    expect(compose).not.toMatch(/-d app\b/);
    expect(files.find((f) => f.path === ".env.example")!.content).toContain("localhost:5432/loja_cafe");
  });

  it("segredos: aleatórios no .env, nada de senha fixa no compose", () => {
    const { graph, er } = sample();
    graph.nodes.push({ id: "s3", kind: "storage", name: "Arquivos", props: {}, position: { x: 0, y: 0 } } as never);
    const a = archFiles(graph, er);
    const b = archFiles(graph, er);
    const get = (fs: typeof a, p: string) => fs.find((f) => f.path === p)!.content;
    const compose = get(a, "docker-compose.yml");
    const env = get(a, ".env");

    // compose exige as variáveis (falha com mensagem clara se faltar o .env)
    expect(compose).toContain("POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?defina POSTGRES_PASSWORD no .env}");
    expect(compose).toContain("DATABASE_URL: postgres://app:${POSTGRES_PASSWORD:?");
    expect(compose).not.toMatch(/POSTGRES_PASSWORD: app\b|app:app@|minio12345|troque-este-segredo-em-producao/);

    // .env com valores hex aleatórios, diferentes a cada export
    const pw = /^POSTGRES_PASSWORD=([0-9a-f]{32})$/m.exec(env)?.[1];
    expect(pw).toBeTruthy();
    expect(env).toContain(`DATABASE_URL=postgres://app:${pw}@localhost:5432/app`);
    expect(get(b, ".env")).not.toContain(pw!);

    // .env.example só tem marcadores; .gitignore protege o .env
    expect(get(a, ".env.example")).toContain("POSTGRES_PASSWORD=troque-esta-senha");
    expect(get(a, ".env.example")).not.toContain(pw!);
    expect(get(a, ".gitignore")).toMatch(/^\.env$/m);
  });

  it("segredos fixos podem ser injetados (export reproduzível)", () => {
    const { graph, er } = sample();
    const s = { postgresPassword: "a".repeat(32), jwtSecret: "b".repeat(64), minioPassword: "c".repeat(32) };
    expect(archFiles(graph, er, s)).toEqual(archFiles(graph, er, s));
  });

  it("banco, Redis e MinIO só escutam no localhost; APIs continuam acessíveis", () => {
    const { graph, er } = sample();
    graph.nodes.push({ id: "s3", kind: "storage", name: "Arquivos", props: {}, position: { x: 0, y: 0 } } as never);
    const compose = archFiles(graph, er).find((f) => f.path === "docker-compose.yml")!.content;
    for (const port of [5432, 6379, 9000, 9001]) {
      expect(compose).toContain(`"127.0.0.1:${port}:${port}"`);
      expect(compose).not.toContain(`- "${port}:${port}"`);
    }
  });

  it("SQL respeita a ordem pai -> filho e cria FK", () => {
    const { er } = sample();
    const sql = toSql(er, "postgres");
    expect(sql.indexOf('CREATE TABLE "plans"')).toBeLessThan(sql.indexOf('CREATE TABLE "subscriptions"'));
    expect(sql).toMatch(/"plan_id" uuid NOT NULL/);
    expect(sql).toMatch(/REFERENCES "plans" \("id"\) ON DELETE CASCADE/);
    for (const f of dbFiles(er)) expect(f.content.length).toBeGreaterThan(50);
  });

  // GEN_OUT=<pasta> npx vitest run src/lib/arch  -> grava o backend para compilar de verdade.
  it.runIf(!!process.env.GEN_OUT)("grava os arquivos em GEN_OUT", () => {
    const { graph, er } = sample();
    for (const f of [...archFiles(graph, er), ...dbFiles(er)]) {
      const p = join(process.env.GEN_OUT!, f.path);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, f.content);
    }
  });
});
