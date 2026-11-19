// Monta o projeto completo num conjunto de arquivos: site (web/, uma página
// HTML por página do Studio), backend (raiz, com docker-compose) e schemas do
// banco (db/). Puro: testável sem DOM.
import type { ArchGraph } from "@/lib/arch/model";
import { archFiles } from "@/lib/arch/codegen";
import { dbFiles, type GeneratedFile } from "@/lib/db/codegen";
import type { ErModel } from "@/lib/db/model";

export interface WebPage {
  /** index.html, cardapio.html… */
  file: string;
  name: string;
  html: string;
  /** true quando a página não tinha Reimaginar e saiu na versão automática. */
  auto?: boolean;
}

export interface ProjectInput {
  /** Páginas do site já em HTML estático (vazio se não houver landing). */
  webPages: WebPage[];
  arch: ArchGraph;
  db: ErModel;
  /** Projeto React (Vite) do site, já com caminhos react/… */
  react?: GeneratedFile[];
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

export function hasProjectContent({ webPages, arch, db }: ProjectInput): boolean {
  return webPages.length > 0 || arch.nodes.length > 0 || db.tables.length > 0;
}

function projectReadme(parts: { pages: WebPage[]; backend: boolean; db: boolean; react: boolean }, backendReadme?: string): string {
  const web = parts.pages.length > 0;
  const lines = ["# Projeto exportado do Vitrine Studio", "", "## O que vem neste zip", ""];
  if (web) {
    lines.push(parts.pages.length > 1 ? `- \`web/\`: o site, com ${parts.pages.length} páginas em HTML estático (abrem direto no navegador):` : "- `web/index.html`: a landing page, em HTML estático (abre direto no navegador).");
    if (parts.pages.length > 1) for (const p of parts.pages) lines.push(`  - \`web/${p.file}\`: ${p.name}${p.auto ? " (versão automática: ainda não reimaginada)" : ""}`);
  }
  if (parts.react) lines.push("- `react/`: o mesmo site como projeto React (Vite + Tailwind), para editar o código: `cd react && npm install && npm run dev`.");
  if (parts.backend) lines.push("- `docker-compose.yml`, `.env.example` e as pastas dos serviços: o backend gerado pelo canvas de Arquitetura.");
  if (parts.db) lines.push("- `db/`: o schema do canvas Banco em SQL (Postgres, MySQL, SQLite), Prisma, Drizzle e DBML.");
  if (!web) lines.push("", "_O site não foi incluído: clique em **Reimaginar** no Studio antes de exportar._");
  lines.push("", "## Como rodar", "");
  if (parts.backend) {
    lines.push("```bash", "cp .env.example .env", "docker compose up --build", "```", "");
    if (web) lines.push(`O site fica em http://localhost:${WEB_PORT} (serviço \`web\`, nginx) e a API nas portas listadas abaixo.`, "");
  } else if (web) {
    lines.push("Abra `web/index.html` no navegador, ou sirva a pasta com `npx serve web`.", "");
  } else {
    lines.push("Aplique `db/schema.postgres.sql` (ou o dialeto do seu banco) com o cliente de sua preferência.", "");
  }
  if (backendReadme) lines.push("---", "", backendReadme.replace(/^# /, "## Backend: "));
  return lines.join("\n").trimEnd() + "\n";
}

export function projectFiles(input: ProjectInput): GeneratedFile[] {
  const { webPages, arch, db } = input;
  const web = webPages.length > 0;
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
  for (const p of webPages) out.push({ path: `web/${p.file}`, content: p.html });
  if (input.react?.length) out.push(...input.react);

  const hasDb = out.some((f) => f.path.startsWith("db/"));
  out.unshift({ path: "README.md", content: projectReadme({ pages: webPages, backend, db: hasDb, react: !!input.react?.length }, backendReadme) });
  return out;
}
