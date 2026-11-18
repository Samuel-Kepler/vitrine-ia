// Monta o projeto completo num conjunto de arquivos: landing (web/), backend
// (raiz, com docker-compose) e schemas do banco (db/). Puro: testável sem DOM.
import type { ArchGraph } from "@/lib/arch/model";
import { archFiles } from "@/lib/arch/codegen";
import { dbFiles, type GeneratedFile } from "@/lib/db/codegen";
import type { ErModel } from "@/lib/db/model";

export interface ProjectInput {
  /** HTML estático da landing (null se ainda não houve Reimaginar). */
  landingHtml: string | null;
  arch: ArchGraph;
  db: ErModel;
}

export const WEB_PORT = 8080;

const WEB_SERVICE = [
  "  web:",
  "    image: nginx:1.27-alpine",
  "    ports:",
  `      - "${WEB_PORT}:80"`,
  "    volumes:",
  "      - ./web:/usr/share/nginx/html:ro",
  "    restart: on-failure",
].join("\n");

export function hasProjectContent({ landingHtml, arch, db }: ProjectInput): boolean {
  return !!landingHtml || arch.nodes.length > 0 || db.tables.length > 0;
}

function projectReadme(parts: { web: boolean; backend: boolean; db: boolean }, backendReadme?: string): string {
  const lines = ["# Projeto exportado do Vitrine Studio", "", "## O que vem neste zip", ""];
  if (parts.web) lines.push("- `web/index.html`: a landing page, em HTML estático (abre direto no navegador).");
  if (parts.backend) lines.push("- `docker-compose.yml`, `.env.example` e as pastas dos serviços: o backend gerado pelo canvas de Arquitetura.");
  if (parts.db) lines.push("- `db/`: o schema do canvas Banco em SQL (Postgres, MySQL, SQLite), Prisma, Drizzle e DBML.");
  if (!parts.web) lines.push("", "_A landing não foi incluída: clique em **Reimaginar** no Studio antes de exportar._");
  lines.push("", "## Como rodar", "");
  if (parts.backend) {
    lines.push("```bash", "cp .env.example .env", "docker compose up --build", "```", "");
    if (parts.web) lines.push(`A landing fica em http://localhost:${WEB_PORT} (serviço \`web\`, nginx) e a API nas portas listadas abaixo.`, "");
  } else if (parts.web) {
    lines.push("Abra `web/index.html` no navegador, ou sirva a pasta com `npx serve web`.", "");
  } else {
    lines.push("Aplique `db/schema.postgres.sql` (ou o dialeto do seu banco) com o cliente de sua preferência.", "");
  }
  if (backendReadme) lines.push("---", "", backendReadme.replace(/^# /, "## Backend: "));
  return lines.join("\n").trimEnd() + "\n";
}

export function projectFiles(input: ProjectInput): GeneratedFile[] {
  const { landingHtml, arch, db } = input;
  const web = !!landingHtml;
  const backend = arch.nodes.length > 0;
  const out: GeneratedFile[] = [];
  let backendReadme: string | undefined;

  if (backend) {
    for (const f of archFiles(arch, db)) {
      if (f.path === "README.md") backendReadme = f.content;
      else if (f.path === "docker-compose.yml" && web) out.push({ ...f, content: f.content.replace(/^services:\r?\n/m, (m) => `${m}${WEB_SERVICE}\n`) });
      else out.push(f);
    }
  } else if (db.tables.length) {
    out.push(...dbFiles(db));
  }
  if (web) out.push({ path: "web/index.html", content: landingHtml! });

  const hasDb = out.some((f) => f.path.startsWith("db/"));
  out.unshift({ path: "README.md", content: projectReadme({ web, backend, db: hasDb }, backendReadme) });
  return out;
}
